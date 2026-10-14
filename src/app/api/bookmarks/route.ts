import { NextRequest, NextResponse } from 'next/server';
import { getBookmarks, createBookmark, getAllTags } from '@/db/queries';
import { captureScreenshot } from '@/lib/capture';
import { validateSafeUrl } from '@/lib/ssrf';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const bookmarks = getBookmarks({ query, tag, status, limit, offset });
    const tags = getAllTags();

    return NextResponse.json({ bookmarks, tags });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch bookmarks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, tag_names } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }
    const safetyCheck = await validateSafeUrl(cleanUrl);
    if (!safetyCheck.safe) {
      return NextResponse.json({ error: safetyCheck.reason || 'Forbidden URL target' }, { status: 422 });
    }

    const bookmark = createBookmark({
      url: cleanUrl,
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
      tag_names: Array.isArray(tag_names) ? tag_names : [],
    });

    // Trigger non-blocking asynchronous capture
    void captureScreenshot(bookmark.id, bookmark.url);

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create bookmark';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
