/**
 * Detects screenshots that contain nothing worth showing.
 *
 * A headless browser renders an empty white page for sites that paint client-side behind a
 * consent wall, or that refuse the request outright. The capture "succeeds" and the card shows
 * a blank rectangle, which is worse than an honest failure because there is nothing to retry.
 *
 * The check is deliberately cheap: decode the image, sample a grid of pixels, and report blank
 * when almost every sample is near-white. It runs on the encoded bytes, so no extra dependency
 * is needed beyond the image decoder Playwright already brings in.
 */
import { chromium } from 'playwright';

export interface BlankCheck {
  blank: boolean;
  /** Share of sampled pixels that are near-white, 0-1. */
  whiteRatio: number;
}

/**
 * Decodes an image in a throwaway page and samples a grid of its pixels.
 *
 * Runs in the capture browser so no image library is added to the dependency tree. Any failure
 * returns `blank: false`: a check that cannot run must never reject a real screenshot.
 */
export async function isBlankImage(
  bytes: Buffer,
  mimeType: string,
): Promise<BlankCheck> {
  if (bytes.byteLength === 0) return { blank: true, whiteRatio: 1 };

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();

    const dataUrl = `data:${mimeType};base64,${bytes.toString('base64')}`;
    const result = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode().catch(() => {});

      if (!image.naturalWidth || !image.naturalHeight) return null;

      const canvas = document.createElement('canvas');
      // A small canvas is enough: a blank page is blank at any resolution.
      canvas.width = 64;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let white = 0;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        total += 1;
        // Near-white and opaque: text and images leave darker pixels behind.
        if (a > 200 && r > 244 && g > 244 && b > 244) white += 1;
      }
      return total > 0 ? white / total : null;
    }, dataUrl);

    if (result === null) return { blank: false, whiteRatio: 0 };
    // A page with any real content keeps well under this; an empty render is 1.0.
    return { blank: result > 0.985, whiteRatio: result };
  } catch {
    return { blank: false, whiteRatio: 0 };
  } finally {
    await browser?.close().catch(() => {});
  }
}
