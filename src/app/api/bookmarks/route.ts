import { NextRequest, NextResponse } from 'next/server';
import { getBookmarks, createBookmark, getAllTags, getAllFolders, getViewCounts, hashUrl } from '@/db/queries';
import { getDb } from '@/db/index';
import { captureScreenshot } from '@/lib/capture';
import { validateSafeUrl } from '@/lib/ssrf';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') as 'all' | 'favorites' | 'recent' | 'archive' | 'trash') || 'all';
    const folderId = searchParams.get('folderId') || undefined;
    const query = searchParams.get('q') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const status = searchParams.get('status') || undefined;
    const sortBy = (searchParams.get('sort') as 'most_used' | 'recent' | 'alphabetical') || 'most_used';
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const bookmarks = getBookmarks({ query, tag, status, view, folderId, sortBy, limit, offset });
    const tags = getAllTags();
    const folders = getAllFolders();
    const counts = getViewCounts();

    return NextResponse.json({ bookmarks, tags, folders, counts });
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
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 });
    }

    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Normalize URL: remove trailing slash, query order, etc.
    try {
      const parsed = new URL(cleanUrl);
      // Remove trailing slash if pathname is just '/'
      if (parsed.pathname === '/') {
        parsed.pathname = '';
      }
      cleanUrl = parsed.toString().replace(/\/$/, '');
    } catch {
      // use cleanUrl as is
    }

    const url_hash = hashUrl(cleanUrl);
    const existing = getDb().prepare('SELECT id FROM bookmarks WHERE url_hash = ?').get(url_hash) as { id: string } | undefined;
    if (existing) {
      return NextResponse.json({ error: 'This URL has already been bookmarked!', existingId: existing.id }, { status: 409 });
    }

    const safetyCheck = await validateSafeUrl(cleanUrl);
    if (!safetyCheck.safe) {
      return NextResponse.json({ error: safetyCheck.reason || 'Website could not be reached or is invalid' }, { status: 422 });
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
