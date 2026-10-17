import pLimit from 'p-limit';
import { validateSafeUrl } from './ssrf';
import { updateBookmarkStatus } from '../db/queries';
import { config } from './config';
import {
  ensureScreenshotDir,
  renderScreenshot,
  type CaptureRequest,
  type CaptureResult,
} from './captureProviders';
import { fetchPageMetadata } from './pageMetadata';

/**
 * Effective parallelism.
 *
 * The local provider is capped at two contexts: higher caps spike memory and stall the app.
 * The API provider does its rendering elsewhere, so it may run wider.
 */
const effectiveConcurrency = config.captureProviders.includes('local')
  ? Math.min(2, config.captureConcurrency)
  : config.captureConcurrency;

const limit = pLimit(effectiveConcurrency);

/** Captures that are queued or running in this process, so a duplicate request is a no-op. */
const inFlight = new Set<string>();

let reconciled = false;

export interface CaptureOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  timeoutMs?: number;
}

function settle(bookmarkId: string, result: CaptureResult): CaptureResult {
  if (result.success && result.screenshotPath) {
    updateBookmarkStatus(
      bookmarkId,
      'ready',
      result.screenshotPath,
      null,
      result.title ?? null,
      result.faviconUrl ?? null,
      result.description ?? null,
    );
  } else {
    updateBookmarkStatus(
      bookmarkId,
      'failed',
      null,
      result.error || 'Screenshot capture failed',
    );
  }
  return result;
}

/**
 * Captures a screenshot and records the outcome on the bookmark.
 *
 * Every path settles the row: a capture that is accepted and then never finishes is worse than
 * one that fails, because the card spins forever with no way out. The body is wrapped so an
 * unexpected throw (a failed browser launch, a network error from the API) is written as
 * `failed` instead of escaping as an unhandled rejection.
 */
export async function captureScreenshot(
  bookmarkId: string,
  url: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  if (!config.captureEnabled) {
    updateBookmarkStatus(bookmarkId, 'disabled');
    return { success: false, error: 'Screenshot capture is disabled' };
  }

  if (inFlight.has(bookmarkId)) {
    return { success: false, error: 'Capture already in progress' };
  }
  inFlight.add(bookmarkId);

  try {
    // The SSRF guard runs before any browser or HTTP client touches the URL.
    const ssrfCheck = await validateSafeUrl(url);
    if (!ssrfCheck.safe) {
      return settle(bookmarkId, {
        success: false,
        error: ssrfCheck.reason || 'Forbidden URL target',
      });
    }

    ensureScreenshotDir();

    return await limit(async () => {
      updateBookmarkStatus(bookmarkId, 'capturing');

      const request: CaptureRequest = {
        bookmarkId,
        url,
        timeoutMs: options.timeoutMs ?? config.captureTimeoutMs,
        launchTimeoutMs: config.captureLaunchTimeoutMs,
        viewportWidth: options.viewportWidth ?? config.captureViewportWidth,
        viewportHeight: options.viewportHeight ?? config.captureViewportHeight,
      };

      try {
        const result = await renderScreenshot(request);

        // An image-only provider returns no title or description. Reading the page's own meta
        // tags costs no API quota, so a successful capture always ends up with both when the
        // page publishes them.
        if (result.success && (!result.title || !result.description)) {
          const metadata = await fetchPageMetadata(url, request.timeoutMs);
          result.title = result.title ?? metadata.title;
          result.description = result.description ?? metadata.description;
        }

        return settle(bookmarkId, result);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown screenshot capture error';
        return settle(bookmarkId, { success: false, error: message });
      }
    });
  } catch (err: unknown) {
    // Reached when the guard itself throws, or the limiter is torn down.
    const message =
      err instanceof Error ? err.message : 'Unknown screenshot capture error';
    return settle(bookmarkId, { success: false, error: message });
  } finally {
    inFlight.delete(bookmarkId);
  }
}

/**
 * Requeues captures that were interrupted by a restart.
 *
 * `capturing` is a claim held by a running process. Nothing advances it after the process
 * that set it is gone, so on boot those rows would render as spinners forever. They are
 * queued again, and the caller awaits nothing.
 */
export async function recoverInterruptedCaptures(
  staleIds: Array<{ id: string; url: string }>,
): Promise<void> {
  for (const row of staleIds) {
    void captureScreenshot(row.id, row.url).catch(() => {});
  }
}

/**
 * Runs the boot-time recovery exactly once per process.
 *
 * Called from the data layer rather than a framework hook: this project runs on Next's dev
 * server as much as on `next start`, and a module-level guard survives the module reloads that
 * dev does, while an instrumentation hook does not.
 */
export async function reconcileCaptureStateOnce(): Promise<void> {
  if (reconciled) return;
  reconciled = true;

  const { getStalledCaptures, failStalledCaptures } = await import('../db/queries');

  if (!config.captureEnabled) {
    failStalledCaptures('Screenshot capture is disabled');
    return;
  }

  // A capture cannot legitimately run longer than its navigation budget plus the launch
  // budget, so anything older than both is work that died with the previous process. The grace
  // period also keeps a second process from stealing a capture that is genuinely in flight.
  const stalled = getStalledCaptures(
    config.captureTimeoutMs + config.captureLaunchTimeoutMs,
  );
  if (stalled.length > 0) {
    console.info(`[capture] requeueing ${stalled.length} interrupted capture(s)`);
    await recoverInterruptedCaptures(stalled);
  }
}

export async function closeCaptureBrowser(): Promise<void> {
  if (config.captureProviders.includes('local')) {
    const { closeLocalBrowser } = await import('./captureProviders');
    await closeLocalBrowser();
  }
}
