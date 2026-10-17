/**
 * Runtime configuration, read once from the environment.
 *
 * Everything a deployment needs to tune lives here, so the same image runs on a laptop and on
 * a small always-on box. Values are validated once at import time: a typo fails loudly at boot
 * instead of silently falling back to a default that eats the machine's RAM.
 */

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max} (got "${raw}")`,
    );
  }
  return value;
}

function boolFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  throw new Error(`${name} must be one of true/false (got "${raw}")`);
}

const PROVIDER_NAMES = ['local', 'thum', 'sb'] as const;

/**
 * Parses a comma-separated provider chain: `local,api` means "try local, fall back to api".
 * Order is meaningful, so it is preserved; duplicates are dropped.
 */
function providerChainFromEnv(
  name: string,
  fallback: readonly CaptureProvider[],
): CaptureProvider[] {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return [...fallback];

  const allowed = [...PROVIDER_NAMES, 'none'] as const;
  const names = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (names.length === 0) return [...fallback];

  for (const name_ of names) {
    if (!(allowed as readonly string[]).includes(name_)) {
      throw new Error(
        `${name} must be a comma-separated list of ${allowed.join('/')} (got "${raw}")`,
      );
    }
  }

  // `none` anywhere means "no capture", regardless of what else is listed.
  if (names.includes('none')) return [];
  return [...new Set(names as CaptureProvider[])];
}

function stringFromEnv(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw === undefined || raw === '' ? fallback : raw;
}

/**
 * One renderer in the capture chain.
 *
 * `local` is Chromium on this machine. `thum` and `sb` are two API slots with their own URL and
 * key, so a keyless service and a keyed one can sit in the same chain — `local,thum,sb` renders
 * locally, falls back to thum.io when the limit is hit, then to screenshotbase.
 */
export type CaptureProvider = 'local' | 'thum' | 'sb';


export const config = {
  /**
   * Screenshot capture needs a browser: ~280MB of disk and 150-250MB of RAM per live page.
   * Set this to false to run the app as a plain bookmark manager — cards fall back to a
   * domain tile, nothing is queued, and the retry affordance is hidden.
   */
  captureEnabled: boolFromEnv('CAPTURE_ENABLED', true),

  /**
   * Renderers to try, in order. `local` uses Chromium on this machine; `api` posts the URL to
   * an external screenshot service, which keeps the app's own memory flat. `local,api` renders
   * locally and falls back to the service when that fails; `api` alone needs a key or a
   * keyless service URL.
   */
  captureProviders: providerChainFromEnv('CAPTURE_PROVIDER', ['local']),

  /**
   * How many captures may run at once. Each live local page costs roughly 150-250MB of RAM,
   * so the local provider is capped at two regardless of this value (see `capture.ts`).
   */
  captureConcurrency: intFromEnv('CAPTURE_CONCURRENCY', 2, 1, 8),

  /** Per-capture navigation budget, in milliseconds. */
  captureTimeoutMs: intFromEnv('CAPTURE_TIMEOUT_MS', 30000, 5000, 120000),

  /**
   * Hard ceiling for one bookmark across the whole provider chain, in milliseconds.
   *
   * The chain is not allowed to exceed this: a slow local render is cut off and the next
   * provider takes over with whatever budget is left. Past this point the capture fails
   * rather than holding a queue slot, so the rest of the queue keeps moving.
   */
  captureDeadlineMs: intFromEnv('CAPTURE_DEADLINE_MS', 60000, 10000, 300000),

  /**
   * How long a Chromium launch may take before it is treated as a failure. Without this a
   * failed launch can hang a queue slot forever, which surfaces as a card stuck on
   * "Capturing preview...".
   */
  captureLaunchTimeoutMs: intFromEnv('CAPTURE_LAUNCH_TIMEOUT_MS', 30000, 5000, 120000),

  /**
   * Keep the Chromium process warm between captures. Warm saves about a second per capture
   * but holds 100-150MB of RAM while idle. On a memory-tight machine set this to false: the
   * process is closed after each capture and the memory goes back to the OS.
   */
  captureKeepBrowserAlive: boolFromEnv('CAPTURE_KEEP_BROWSER_ALIVE', true),

  /** Viewport used for the screenshot. Smaller is cheaper to render. */
  captureViewportWidth: intFromEnv('CAPTURE_VIEWPORT_WIDTH', 1280, 320, 2560),
  captureViewportHeight: intFromEnv('CAPTURE_VIEWPORT_HEIGHT', 800, 240, 1600),

  /**
   * API slot `thum`: a keyless service (thum.io by default). No key is needed.
   * Placeholders: `{url}` (encoded), `{width}`, `{height}`, `{key}`.
   */
  thumUrl: stringFromEnv(
    'CAPTURE_THUM_URL',
    'https://image.thum.io/get/width/{width}/crop/{height}/{url}',
  ),
  thumKey: stringFromEnv('CAPTURE_THUM_KEY', ''),

  /**
   * API slot `sb`: a keyed service (screenshotbase by default). When the URL template has no
   * `{key}`, the key is sent as an `apikey` header, which is what screenshotbase expects.
   */
  sbUrl: stringFromEnv(
    'CAPTURE_SB_URL',
    'https://api.screenshotbase.com/v1/take?url={url}&format=webp&viewport_width={width}&viewport_height={height}',
  ),
  sbKey: stringFromEnv('CAPTURE_SB_KEY', ''),

  /**
   * Minimum gap between two calls to the same API slot, in milliseconds.
   *
   * Free tiers rate-limit per minute, and a burst of captures otherwise burns the quota on
   * 429s. Requests are serialised per slot with this spacing.
   */
  captureApiMinIntervalMs: intFromEnv('CAPTURE_API_MIN_INTERVAL_MS', 2000, 0, 60000),

  /**
   * Reject a capture whose image is (nearly) blank.
   *
   * Some pages render an empty body to a headless browser — a consent wall that never
   * painted, or a client-side app that needs a login. Saving that image looks like success
   * and shows a white card, so it is treated as a failure and the next provider is tried.
   */
  captureRejectBlank: boolFromEnv('CAPTURE_REJECT_BLANK', true),

  /**
   * Hard ceiling on one API capture, in milliseconds.
   *
   * Kept below the chain deadline so the last provider still gets a real chance: with a 60s
   * deadline, a 20s API ceiling leaves room for a local attempt and two API slots.
   */
  captureApiTimeoutMs: intFromEnv('CAPTURE_API_TIMEOUT_MS', 20000, 5000, 120000),

  /**
   * Ask the screenshot service for page metadata (title, description) as well as the image.
   *
   * Only screenshotbase supports it: `response_type=json` returns the capture's metadata, and
   * `markdown=1` gives the page text, from which the description is taken. thum.io returns a
   * bare PNG, so a capture that ends there keeps the title it was saved with.
   */
  captureApiMetadata: boolFromEnv('CAPTURE_API_METADATA', true),
} as const;

if (config.captureEnabled && config.captureProviders.includes('sb') && !config.sbKey) {
  throw new Error(
    'CAPTURE_PROVIDER includes "sb" but CAPTURE_SB_KEY is empty (get a free key at https://app.screenshotbase.com/register)',
  );
}

export type AppConfig = typeof config;
