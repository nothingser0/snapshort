import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots');

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

/**
 * Serves a captured screenshot.
 *
 * `next start` serves `public/` as a snapshot taken at build time, so a file written after the
 * build — which is every capture — returns 404. Reading from disk per request fixes that and
 * keeps the stored URL (`/screenshots/<id>.webp`) unchanged.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  // One path segment, no traversal: the capture writer only ever produces `<id>.<ext>`.
  if (!/^[A-Za-z0-9_-]+\.(webp|png|jpe?g|gif|avif)$/.test(file)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const target = path.join(SCREENSHOT_DIR, file);
  if (path.dirname(path.resolve(target)) !== path.resolve(SCREENSHOT_DIR)) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const data = await fs.readFile(target);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
        // Captures are immutable: the filename is the bookmark id, written once.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
