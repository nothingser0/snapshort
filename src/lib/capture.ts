import { chromium, type Browser } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import pLimit from 'p-limit';
import { validateSafeUrl } from './ssrf';
import { updateBookmarkStatus } from '../db/queries';

const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots');
const limit = pLimit(2); // Concurrency cap

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

export interface CaptureOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  timeoutMs?: number;
}

export async function captureScreenshot(
  bookmarkId: string,
  url: string,
  options: CaptureOptions = {}
): Promise<{ success: boolean; screenshotPath?: string; title?: string; faviconUrl?: string; error?: string }> {
  return limit(async () => {
    // 1. SSRF Safety Check
    const ssrfCheck = await validateSafeUrl(url);
    if (!ssrfCheck.safe) {
      const err = ssrfCheck.reason || 'Forbidden URL target';
      updateBookmarkStatus(bookmarkId, 'failed', null, err);
      return { success: false, error: err };
    }

    // 2. Mark capturing in progress
    updateBookmarkStatus(bookmarkId, 'capturing');

    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: {
        width: options.viewportWidth || 1280,
        height: options.viewportHeight || 800,
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    const timeout = options.timeoutMs || 15000;
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    try {
      // 3. Navigate to URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

      // Short delay for client fonts and layout stabilization
      const { promise: delayPromise, resolve: delayResolve } = Promise.withResolvers<void>();
      setTimeout(delayResolve, 1200);
      await delayPromise;

      let title = (await page.title())?.trim() || undefined;
      if (!title || title.startsWith('http://') || title.startsWith('https://')) {
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          title = host.charAt(0).toUpperCase() + host.slice(1);
        } catch {
          title = url;
        }
      }

      // Extract meta description automatically
      const description = await page.evaluate(() => {
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                         document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
        if (metaDesc && metaDesc.trim()) {
          return metaDesc.trim();
        }
        // Fallback: first readable paragraph
        const p = document.querySelector('p');
        if (p && p.innerText && p.innerText.trim().length > 20) {
          return p.innerText.trim().slice(0, 180);
        }
        return null;
      }).catch(() => null);

      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

      // 4. Capture screenshot
      const filename = `${bookmarkId}.png`;
      const targetFilePath = path.join(SCREENSHOT_DIR, filename);
      const publicPath = `/screenshots/${filename}`;

      await page.screenshot({
        path: targetFilePath,
        type: 'png',
        fullPage: false,
      });

      // 5. Update DB record to ready
      updateBookmarkStatus(bookmarkId, 'ready', publicPath, null, title, faviconUrl, description);

      return {
        success: true,
        screenshotPath: publicPath,
        title,
        description: description || undefined,
        faviconUrl,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown screenshot capture error';
      updateBookmarkStatus(bookmarkId, 'failed', null, message);
      return {
        success: false,
        error: message,
      };
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  });
}

export async function closeCaptureBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
