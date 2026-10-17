/**
 * Reads a page's own metadata over plain HTTP.
 *
 * Screenshot services return an image, and the ones that can return metadata charge a second
 * render for it. Fetching the HTML costs no API quota and works for every provider, so the
 * title and description are read here whenever a capture came back without them.
 *
 * This is best-effort by design: pages that render client-side have no meta tags in the HTML,
 * and a failure simply leaves the stored title in place.
 */
import { validateSafeUrl } from './ssrf';

export interface PageMetadata {
  title?: string;
  description?: string;
}

const MAX_HTML_BYTES = 512 * 1024;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1]?.trim();
    if (value && value.length > 0) return decodeEntities(value);
  }
  return null;
}

/** `<meta>` tags appear in either attribute order, so both spellings are tried. */
function metaTag(name: string): RegExp[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(
      `<meta[^>]+(?:name|property|itemprop)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property|itemprop)=["']${escaped}["']`,
      'i',
    ),
  ];
}

/** Visible text of the first substantial paragraph, used when a page publishes no meta tag. */
function firstParagraph(html: string): string | null {
  const withoutNoise = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const paragraphs = withoutNoise.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
  for (const paragraph of paragraphs) {
    const text = decodeEntities(paragraph.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 40 && !/cookie|javascript/i.test(text)) {
      return text.slice(0, 240);
    }
  }
  return null;
}

export function parsePageMetadata(html: string): PageMetadata {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch?.[1] ? decodeEntities(titleMatch[1]).trim() : '';

  const description =
    metaContent(html, metaTag('og:description')) ||
    metaContent(html, metaTag('description')) ||
    metaContent(html, metaTag('twitter:description')) ||
    firstParagraph(html);

  return {
    title: rawTitle ? rawTitle.slice(0, 300) : undefined,
    description: description ? description.slice(0, 240) : undefined,
  };
}

export async function fetchPageMetadata(
  url: string,
  timeoutMs: number,
): Promise<PageMetadata> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        // Some sites serve a bare shell to unknown agents; a browser UA gets the real markup.
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) return {};

    // A redirect can leave the validated origin, so the final URL is checked as well.
    const finalUrl = response.url || url;
    if (finalUrl !== url) {
      const check = await validateSafeUrl(finalUrl);
      if (!check.safe) return {};
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('html')) return {};

    const reader = response.body?.getReader();
    if (!reader) return {};

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
    await reader.cancel().catch(() => {});

    const html = new TextDecoder('utf-8', { fatal: false }).decode(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    );

    return parsePageMetadata(html);
  } catch {
    return {};
  }
}
