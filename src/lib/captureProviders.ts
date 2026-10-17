import { chromium, type Browser, type Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config';

const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots');

export interface CaptureRequest {
  bookmarkId: string;
  url: string;
  timeoutMs: number;
  launchTimeoutMs: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface CaptureResult {
  success: boolean;
  screenshotPath?: string;
  title?: string;
  description?: string;
  faviconUrl?: string;
  error?: string;
}

/**
 * Rejects when `work` does not settle in time, so a hung step can never hold a queue slot
 * forever. The caller closes the browser context on rejection, which aborts the page work.
 */
async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Local provider: Chromium on this machine
// ---------------------------------------------------------------------------

let browserInstance: Browser | null = null;
// Single flight: two concurrent captures must share one launch, not race two Chromium
// processes. A race here was what left cards stuck when several links were added at once.
let browserLaunch: Promise<Browser> | null = null;

async function getBrowser(timeoutMs: number): Promise<Browser> {
  if (browserInstance?.isConnected()) return browserInstance;

  if (!browserLaunch) {
    browserLaunch = chromium
      .launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
      .then((browser) => {
        browserInstance = browser;
        browser.on('disconnected', () => {
          if (browserInstance === browser) browserInstance = null;
        });
        return browser;
      })
      .finally(() => {
        browserLaunch = null;
      });
  }

  return withTimeout(browserLaunch, timeoutMs, 'Chromium launch');
}

function fallbackTitle(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.charAt(0).toUpperCase() + host.slice(1);
  } catch {
    return url;
  }
}

async function readPageTitle(page: Page, url: string): Promise<string> {
  const raw = (await page.title())?.trim();
  if (raw && !raw.startsWith('http://') && !raw.startsWith('https://')) return raw;
  return fallbackTitle(url);
}

async function readDescription(page: Page): Promise<string | null> {
  return page
    .evaluate(() => {
      const selectors = [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[itemprop="description"]',
      ];
      for (const selector of selectors) {
        const value = document.querySelector(selector)?.getAttribute('content');
        if (value && value.trim().length > 5) return value.trim().slice(0, 240);
      }
      const contentSelectors = ['article p', 'main p', '.lead', 'header + div p', 'p'];
      for (const selector of contentSelectors) {
        for (const node of Array.from(document.querySelectorAll(selector))) {
          const text = (node as HTMLElement).innerText?.trim();
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
}

async function renderWithBrowser(request: CaptureRequest): Promise<CaptureResult> {
  const browser = await getBrowser(request.launchTimeoutMs);
  const context = await withTimeout(
    browser.newContext({
      viewport: {
        width: request.viewportWidth,
        height: request.viewportHeight,
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }),
    request.launchTimeoutMs,
    'Browser context',
  );

  const page = await withTimeout(
    context.newPage(),
    request.launchTimeoutMs,
    'Browser page',
  );
  page.setDefaultTimeout(request.timeoutMs);
  page.setDefaultNavigationTimeout(request.timeoutMs);

  const filename = `${request.bookmarkId}.webp`;
  const targetFilePath = path.join(SCREENSHOT_DIR, filename);

  try {
    // 'domcontentloaded' is the dependable signal; the bounded waits below cover the rest.
    // 'load'/'networkidle' here stall on sites that poll or hold connections open.
    await page
      .goto(request.url, {
        waitUntil: 'domcontentloaded',
        timeout: request.timeoutMs,
      })
      .catch(() => {});

    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});

    // Decode images and fonts so text does not reflow under the shot.
    await withTimeout(
      page
        .evaluate(async () => {
          const images = Array.from(document.images);
          await Promise.all(
            images.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                  }),
            ),
          );
          await document.fonts?.ready?.catch(() => {});
        })
        .catch(() => {}),
      10000,
      'Asset wait',
    ).catch(() => {});

    // Layout stabilisation before the shot.
    await new Promise((resolve) => setTimeout(resolve, 800));

    const title = await readPageTitle(page, request.url);
    const description = await readDescription(page);

    await page.screenshot({
      path: targetFilePath,
      type: 'webp',
      quality: 80,
      fullPage: false,
    });

    return {
      success: true,
      screenshotPath: `/screenshots/${filename}`,
      title,
      description: description || undefined,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${new URL(request.url).hostname}&sz=64`,
    };
  } finally {
    await page.close().catch(() => {});
    // Closing the context aborts any page work still in flight, which is what makes a
    // timed-out capture release its memory instead of lingering.
    await context.close().catch(() => {});

    if (!config.captureKeepBrowserAlive) {
      await closeLocalBrowser();
    }
  }
}

async function renderWithBrowserGuarded(
  request: CaptureRequest,
): Promise<CaptureResult> {
  const budget = request.timeoutMs + 15000;
  return withTimeout(renderWithBrowser(request), budget, 'Capture');
}

export async function closeLocalBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

// ---------------------------------------------------------------------------
// API provider: an external screenshot service renders the page
// ---------------------------------------------------------------------------

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

interface ApiSlot {
  name: 'thum' | 'sb';
  url: string;
  key: string;
  /** Whether the slot can return page metadata next to the image. */
  supportsMetadata: boolean;
}

function slotFor(provider: 'thum' | 'sb'): ApiSlot {
  return provider === 'thum'
    ? { name: 'thum', url: config.thumUrl, key: config.thumKey, supportsMetadata: false }
    : { name: 'sb', url: config.sbUrl, key: config.sbKey, supportsMetadata: true };
}

function buildApiUrl(
  slot: ApiSlot,
  request: CaptureRequest,
): { url: string; sendKeyAsHeader: boolean } {
  const hasKeyPlaceholder = slot.url.includes('{key}');
  let url = slot.url
    .replace(/\{url\}/g, encodeURIComponent(request.url))
    .replace(/\{width\}/g, String(request.viewportWidth))
    .replace(/\{height\}/g, String(request.viewportHeight));

  if (hasKeyPlaceholder) {
    url = url.replace(/\{key\}/g, encodeURIComponent(slot.key));
  }

  return { url, sendKeyAsHeader: !hasKeyPlaceholder };
}

async function writeImage(
  bookmarkId: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const extension = EXTENSIONS[contentType];
  if (!extension) {
    throw new Error(
      `Screenshot service returned "${contentType || 'no content type'}", not an image`,
    );
  }
  if (bytes.byteLength < 1024) {
    throw new Error('Screenshot service returned an empty image');
  }

  const filename = `${bookmarkId}.${extension}`;
  fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), bytes);
  return `/screenshots/${filename}`;
}

/**
 * Fetches an image from an API slot.
 *
 * `response_type=json` (screenshotbase) wraps the image in a JSON envelope; anything else is
 * the image itself. Metadata is best-effort: a capture with an image but no description is a
 * success, not a failure.
 */
async function renderWithApiSlot(
  provider: 'thum' | 'sb',
  request: CaptureRequest,
): Promise<CaptureResult> {
  const slot = slotFor(provider);
  const { url, sendKeyAsHeader } = buildApiUrl(slot, request);

  const headers: Record<string, string> = {};
  if (sendKeyAsHeader && slot.key) headers.apikey = slot.key;

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(config.captureApiTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Screenshot service responded ${response.status}`);
  }

  const contentType = (response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(request.url).hostname}&sz=64`;

  if (contentType.startsWith('application/json')) {
    // Some services answer JSON with a hosted URL instead of the bytes.
    const payload = (await response.json()) as Record<string, unknown>;
    const imageField =
      typeof payload.url === 'string'
        ? payload.url
        : typeof payload.image === 'string'
          ? payload.image
          : (payload.image as Record<string, unknown> | undefined)?.url;

    if (typeof imageField !== 'string' || !imageField) {
      throw new Error('Screenshot service returned JSON without an image');
    }

    const imageResponse = await fetch(imageField, {
      signal: AbortSignal.timeout(config.captureApiTimeoutMs),
    });
    if (!imageResponse.ok) {
      throw new Error(`Screenshot image download responded ${imageResponse.status}`);
    }

    const imageType = (imageResponse.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    return {
      success: true,
      screenshotPath: await writeImage(
        request.bookmarkId,
        Buffer.from(await imageResponse.arrayBuffer()),
        imageType,
      ),
      faviconUrl,
    };
  }

  const screenshotPath = await writeImage(
    request.bookmarkId,
    Buffer.from(await response.arrayBuffer()),
    contentType,
  );

  return {
    success: true,
    screenshotPath,
    // The image carries no page metadata; `capture.ts` fills title and description in.
    faviconUrl,
  };
}

// ---------------------------------------------------------------------------

/**
 * Renders with the first provider in the chain that succeeds.
 *
 * A failing provider is not fatal while another is configured: `local,api` renders locally and
 * only calls the service when the local browser could not produce an image. Errors are
 * combined so the stored `capture_error` names every attempt.
 */
export async function renderScreenshot(
  request: CaptureRequest,
): Promise<CaptureResult> {
  const chain = config.captureProviders;
  if (chain.length === 0) {
    return { success: false, error: 'No capture provider configured' };
  }

  const failures: string[] = [];

  for (const provider of chain) {
    try {
      const result =
        provider === 'local'
          ? await renderWithBrowserGuarded(request)
          : await renderWithApiSlot(provider, request);
      if (result.success) return result;
      failures.push(`${provider}: ${result.error || 'failed'}`);
    } catch (err: unknown) {
      failures.push(
        `${provider}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  return { success: false, error: failures.join('; ') };
}

export function ensureScreenshotDir(): void {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}
