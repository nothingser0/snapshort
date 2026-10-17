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
  options: CaptureOptions = {},
): Promise<{
  success: boolean;
  screenshotPath?: string;
  title?: string;
  faviconUrl?: string;
  error?: string;
}> {
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
    const timeout = options.timeoutMs || 30000;
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    try {
      // 3. Navigate. 'domcontentloaded' is the dependable signal; the asset
      // waits below cover the rest. Using 'load' or 'networkidle' here stalls on
      // sites that poll or hold connections open (github.com never reaches
      // networkidle), which previously pushed captures into the timeout.
      await page
        .goto(url, { waitUntil: 'domcontentloaded', timeout })
        .catch(() => {});

      // Give the page time to finish loading, but cap it: waiting for a fully
      // idle network is not possible on chatty sites, and a bounded wait still
      // captures far more assets than a fixed delay alone.
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});

      // Decode every image, then let fonts finish so text does not reflow.
      await page
        .evaluate(async () => {
          const images = Array.from(document.images);
          await Promise.all(
            images.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener('load', () => resolve(), {
                      once: true,
                    });
                    img.addEventListener('error', () => resolve(), {
                      once: true,
                    });
                  }),
            ),
          );
          await document.fonts?.ready?.catch(() => {});
        })
        .catch(() => {});

      // Layout stabilisation before the shot.
      const { promise: delayPromise, resolve: delayResolve } =
        Promise.withResolvers<void>();
      setTimeout(delayResolve, 800);
      await delayPromise;

      let title = (await page.title())?.trim() || undefined;
      if (
        !title ||
        title.startsWith('http://') ||
        title.startsWith('https://')
      ) {
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          title = host.charAt(0).toUpperCase() + host.slice(1);
        } catch {
          title = url;
        }
      }

      // Extract meta description automatically
      const description = await page
        .evaluate(() => {
          // 1. Meta tag priority
          const selectors = [
            'meta[name="description"]',
            'meta[property="og:description"]',
            'meta[name="twitter:description"]',
            'meta[itemprop="description"]',
          ];
          for (const s of selectors) {
            const val = document.querySelector(s)?.getAttribute('content');
            if (val && val.trim().length > 5) {
              return val.trim().slice(0, 240);
            }
          }
          // 2. Main content heuristics (article paragraphs, lead, main)
          const contentSelectors = [
            'article p',
            'main p',
            '.lead',
            'header + div p',
            'p',
          ];
          for (const cs of contentSelectors) {
            const paras = Array.from(document.querySelectorAll(cs));
            for (const p of paras) {
              const text = (p as HTMLElement).innerText?.trim();
              if (
                text &&
                text.length > 25 &&
                !text.includes('cookie') &&
                !text.includes('JavaScript')
              ) {
                return text.slice(0, 240);
              }
            }
          }
          return null;
        })
        .catch(() => null);

      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

      // 4. Capture screenshot
      const filename = `${bookmarkId}.webp`;
      const targetFilePath = path.join(SCREENSHOT_DIR, filename);
      const publicPath = `/screenshots/${filename}`;

      await page.screenshot({
        path: targetFilePath,
        type: 'webp',
        quality: 80,
        fullPage: false,
      });

      // 5. Update DB record to ready
      updateBookmarkStatus(
        bookmarkId,
        'ready',
        publicPath,
        null,
        title,
        faviconUrl,
        description,
      );

      return {
        success: true,
        screenshotPath: publicPath,
        title,
        description: description || undefined,
        faviconUrl,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown screenshot capture error';
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
