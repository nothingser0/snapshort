'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, type MainView } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { BentoGrid } from '@/components/BentoGrid';
import { PreviewDrawer } from '@/components/PreviewDrawer';
import { usePresence } from '@/lib/usePresence';
import { useIsDesktop } from '@/lib/useMediaQuery';

import type { BookmarkWithTags, Tag } from '@/db/schema';
import { CheckCircle2, Loader2 } from 'lucide-react';

/** Shape the sidebar needs; the API returns folder rows with a count. */
interface FolderOption {
  id: string;
  name: string;
  parent_id: string | null;
  count?: number;
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'loading' | 'success' | 'error';
}

export default function HomePage() {
  const [bookmarks, setBookmarks] = useState<BookmarkWithTags[]>([]);
  /** Whether this deployment renders screenshots; hides retry affordances when false. */
  const [captureEnabled, setCaptureEnabled] = useState(true);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeView, setActiveView] = useState<MainView>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [inspectingBookmark, setInspectingBookmark] =
    useState<BookmarkWithTags | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(
    null,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navEntryRef = useRef(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });
  const [viewCounts, setViewCounts] = useState({
    all: 0,
    favorites: 0,
    recent: 0,
    archive: 0,
    trash: 0,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const showToast = (
    message: string,
    type: ToastState['type'] = 'success',
    duration = 3500,
  ) => {
    setToast({ show: true, message: message.replace(/^Error:\s*/, ''), type });
    if (duration > 0) {
      setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, duration);
    }
  };

  const fetchBookmarks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedTag) params.set('tag', selectedTag);
      if (selectedFolderId) params.set('folderId', selectedFolderId);
      params.set('view', activeView);

      params.set('sort', activeView === 'recent' ? 'recent' : 'most_used');

      const res = await fetch(`/api/bookmarks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedBookmarks: BookmarkWithTags[] = data.bookmarks || [];
        setBookmarks(fetchedBookmarks);
        setCaptureEnabled(data.captureEnabled !== false);
        setTags(data.tags || []);
        setFolders(data.folders || []);

        // Always update global viewCounts accurately from data.counts
        if (data.counts) {
          setViewCounts({
            all: data.counts.all_count ?? 0,
            favorites: data.counts.favorites_count ?? 0,
            recent: data.counts.all_count ?? 0,
            archive: data.counts.archive_count ?? 0,
            trash: data.counts.trash_count ?? 0,
          });
        }
      }
    } catch {
      // Non-critical fetch error
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTag, selectedFolderId, activeView]);

  useEffect(() => {
    // Queued so the fetch (which settles `loading`) does not run inside the
    // effect body; state updates then happen in a normal async continuation.
    queueMicrotask(() => {
      void fetchBookmarks();
    });
  }, [fetchBookmarks]);

  // Captures finish in the background, after the fetch that followed the save. Without this
  // the grid keeps showing "Capturing preview..." until something else triggers a refetch,
  // which is exactly what made a successful capture look stuck.
  const hasUnsettledCaptures = bookmarks.some(
    (b) => b.capture_status === 'pending' || b.capture_status === 'capturing',
  );

  // Queue progress, shown in the header while captures are outstanding: the user asked to see
  // where the queue is, and a bare "Queued..." gives no sense of whether it is moving.
  const pendingCount = bookmarks.filter((b) => b.capture_status === 'pending').length;
  const capturingCount = bookmarks.filter(
    (b) => b.capture_status === 'capturing',
  ).length;

  useEffect(() => {
    if (!hasUnsettledCaptures) return;
    // Poll faster while something is actively rendering, so a finishing capture shows up
    // promptly; the queue is the database, so a slower tick is enough when it is idle.
    const interval = capturingCount > 0 ? 1200 : 2000;
    const timer = setInterval(() => {
      void fetchBookmarks();
    }, interval);
    return () => clearInterval(timer);
  }, [hasUnsettledCaptures, capturingCount, fetchBookmarks]);

  // The drawer is backed by a history entry so the browser/Android Back gesture
  // closes it, which is what a phone user reaches for first.
  const openMobileNav = () => {
    if (!navEntryRef.current) {
      navEntryRef.current = true;
      window.history.pushState({ snapshortNav: true }, '');
    }
    setMobileNavOpen(true);
  };

  const closeMobileNav = () => {
    setMobileNavOpen(false);
    // Drop the entry we added, otherwise Back would be needed twice.
    const state: unknown = window.history.state;
    if (
      navEntryRef.current &&
      typeof state === 'object' &&
      state !== null &&
      'snapshortNav' in state
    ) {
      navEntryRef.current = false;
      window.history.back();
    }
  };

  useEffect(() => {
    const onPopState = () => {
      navEntryRef.current = false;
      setMobileNavOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Esc closes the mobile navigation drawer.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileNav();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  // Keyboard shortcuts advertised by the header placeholders. Ignored while a
  // field already has focus, so typing "/" or "n" never hijacks the input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        // Reveal the add row first on mobile, otherwise the focus target is hidden.
        setAddRowOpen(true);
        requestAnimationFrame(() => {
          urlInputRef.current?.focus();
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Esc cancels whichever confirmation is open
  useEffect(() => {
    if (!pendingDeleteId && !pendingDeleteFolder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setPendingDeleteId(null);
      setPendingDeleteFolder(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pendingDeleteId, pendingDeleteFolder]);

  // Reset to page 1 whenever the filter set changes. State during render avoids
  // both an extra commit and a stale-page flash.
  const filterKey = `${searchQuery}|${selectedTag ?? ''}|${selectedFolderId ?? ''}|${activeView}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    if (currentPage !== 1) setCurrentPage(1);
  }

  const handleCreateFolder = async (name: string, parentId?: string | null) => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId }),
      });
      if (res.ok) {
        showToast('Collection created successfully', 'success', 2000);
        await fetchBookmarks();
      }
    } catch {
      showToast('Failed to create collection', 'error', 2000);
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        showToast('Collection renamed', 'success', 2000);
        await fetchBookmarks();
      }
    } catch {
      showToast('Failed to rename collection', 'error', 2000);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await fetch(`/api/folders/${id}`, { method: 'DELETE' });
      showToast('Collection deleted', 'success', 2000);
      if (selectedFolderId === id) setSelectedFolderId(null);
      await fetchBookmarks();
    } catch {
      showToast('Failed to delete collection', 'error', 2000);
    }
  };

  const handleAddBookmark = async (
    url: string,
    tagNames: string[],
    title?: string,
  ) => {
    showToast('Saving link & capturing screenshot...', 'loading', 0);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tag_names: tagNames, title }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add bookmark');
      }

      showToast(
        'Bookmark saved! Preview processing in background.',
        'success',
        3500,
      );
      await fetchBookmarks();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save bookmark',
        'error',
        4000,
      );
      throw err;
    }
  };

  // Bookmarklet ingest: the drag-to-bookmarks-bar snippet opens this app with
  // ?add_url=...&add_title=..., so the link is saved here and the params removed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addUrl = params.get('add_url');
    if (!addUrl) return;

    const addTitle = params.get('add_title') || undefined;
    params.delete('add_url');
    params.delete('add_title');
    const cleanQuery = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}`,
    );

    // Deferred a tick: saving shows a toast, and setting state during the effect
    // body would trigger a cascading render.
    void Promise.resolve()
      .then(() => handleAddBookmark(addUrl, [], addTitle))
      .catch(() => {});
    // Runs once on mount; handleAddBookmark is stable enough for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetryCapture = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showToast('Retrying screenshot capture...', 'loading', 3000);
    await fetch(`/api/bookmarks/${id}/retry`, { method: 'POST' });
    await fetchBookmarks();
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/bookmarks/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'favorite' }),
      });
      await fetchBookmarks();
    } catch {
      showToast('Failed to update favorite', 'error', 2000);
    }
  };

  const handleToggleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/bookmarks/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });
      showToast('Archive status updated', 'success', 2000);
      await fetchBookmarks();
    } catch {
      showToast('Failed to update archive', 'error', 2000);
    }
  };

  const handleRestoreFromTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/bookmarks/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      showToast('Restored from Trash', 'success', 2000);
      await fetchBookmarks();
    } catch {
      showToast('Failed to restore bookmark', 'error', 2000);
    }
  };

  const handleDeleteBookmark = async (id: string, _e: React.MouseEvent) => {
    _e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    if (activeView === 'trash') {
      // Permanent delete
      await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      showToast('Bookmark permanently deleted', 'success', 2000);
    } else {
      // Move to trash
      await fetch(`/api/bookmarks/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trash' }),
      });
      showToast('Moved to Trash', 'success', 2000);
    }
    if (inspectingBookmark?.id === id) {
      setInspectingBookmark(null);
    }
    setPendingDeleteId(null);
    await fetchBookmarks();
  };

  const handleUpdateBookmark = async (
    id: string,
    data: {
      title?: string;
      url?: string;
      description?: string;
      tag_names?: string[];
    },
  ) => {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save changes');
    }

    const resData = await res.json();
    setInspectingBookmark(resData.bookmark);
    showToast('Changes saved successfully', 'success', 2000);
    await fetchBookmarks();
  };

  // Fired when a bookmark card is dropped on a collection (or on the
  // "remove from collection" drop zone, which passes null).
  const handleAssignFolder = async (
    bookmarkId: string,
    folderId: string | null,
  ) => {
    setDraggingBookmarkId(null);
    try {
      const res = await fetch(`/api/bookmarks/${bookmarkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!res.ok) throw new Error('Failed to move bookmark');

      const folderName = folderId
        ? folders.find((f) => f.id === folderId)?.name
        : null;
      showToast(
        folderName ? `Moved to ${folderName}` : 'Removed from collection',
        'success',
        2000,
      );
      await fetchBookmarks();
    } catch {
      showToast('Failed to move bookmark', 'error', 2000);
    }
  };

  const handleCopyUrl = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL copied to clipboard!', 'success', 2000);
    } catch {
      showToast('Failed to copy URL', 'error', 2000);
    }
  };

  // Uniform pagination: every page holds exactly 6 identical cards (3 columns x 2 rows)
  // Desktop shows a fixed 3x2 board of six cards and pages through the rest.
  // Phones show a single scrolling column of everything: pagination would mean
  // tapping Next repeatedly to see a handful of cards.
  const ITEMS_PER_PAGE = 6;
  const isDesktop = useIsDesktop();
  const totalPages = Math.max(1, Math.ceil(bookmarks.length / ITEMS_PER_PAGE));
  const visibleBookmarks = isDesktop
    ? bookmarks.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE,
      )
    : bookmarks;

  // Overlay presence: keeps each layer mounted while its exit transition plays.
  const toastPresence = usePresence(toast.show, 150);
  const deleteModal = usePresence(Boolean(pendingDeleteId), 150);
  const folderModal = usePresence(Boolean(pendingDeleteFolder), 150);
  const drawerPresence = usePresence(Boolean(inspectingBookmark), 150);
  // Remembers the last bookmark during render, so the drawer keeps its content
  // while the exit transition plays. Adjusting state during render is React's
  // documented pattern for derived state and avoids an extra effect pass.
  const [lastInspected, setLastInspected] = useState<BookmarkWithTags | null>(
    null,
  );
  if (inspectingBookmark && inspectingBookmark !== lastInspected) {
    setLastInspected(inspectingBookmark);
  }
  const drawerBookmark = inspectingBookmark ?? lastInspected;

  return (
    <div className="h-dvh w-full flex overflow-hidden font-sans antialiased bg-[#F8F9FA] text-zinc-900">
      {/* 1. Left Clean Sidebar with 5 Main Views, Collections, and Tag Cloud */}
      <Sidebar
        activeView={activeView}
        mobileOpen={mobileNavOpen}
        onCloseMobile={closeMobileNav}
        // Selection deliberately does NOT close the drawer: a collection that
        // holds subcollections would hide them the moment you tapped it. Closing
        // is explicit (scrim, Esc, or the close button).
        onSelectView={setActiveView}
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onRequestDeleteFolder={(id, name) =>
          setPendingDeleteFolder({ id, name })
        }
        tags={tags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        draggingBookmarkId={draggingBookmarkId}
        onAssignBookmarkToFolder={handleAssignFolder}
        counts={{
          all: viewCounts.all,
          favorites: viewCounts.favorites,
          recent: viewCounts.recent,
          archive: viewCounts.archive,
          trash: viewCounts.trash,
        }}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-white lg:border-l lg:border-zinc-200/80">
        <Header
          onOpenNav={openMobileNav}
          addOpen={addRowOpen}
          onAddOpenChange={setAddRowOpen}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          pendingCaptures={pendingCount}
          capturingNow={capturingCount}
          onAddBookmark={handleAddBookmark}
          onToast={(msg, type) => showToast(msg, type, 2500)}
          searchInputRef={searchInputRef}
          urlInputRef={urlInputRef}
        />

        {/* Gallery Workspace */}
        <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          <BentoGrid
            bookmarks={visibleBookmarks}
            loading={loading}
            captureEnabled={captureEnabled}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onSelectBookmark={(b) => {
              // Opening the drawer is not a visit; only Visit Site counts.
              setInspectingBookmark(b);
            }}
            onOpenExternal={(b) => {
              fetch(`/api/bookmarks/${b.id}/click`, { method: 'POST' }).catch(
                () => {},
              );
              window.open(b.url, '_blank', 'noopener,noreferrer');
            }}
            onRetryCapture={handleRetryCapture}
            onToggleFavorite={handleToggleFavorite}
            onRestoreFromTrash={handleRestoreFromTrash}
            onToggleArchive={handleToggleArchive}
            onDeleteBookmark={handleDeleteBookmark}
            onCopyUrl={handleCopyUrl}
            onToast={(msg, type) => showToast(msg, type, 3000)}
            draggingBookmarkId={draggingBookmarkId}
            onBookmarkDragStart={setDraggingBookmarkId}
            onBookmarkDragEnd={() => setDraggingBookmarkId(null)}
          />
        </main>
      </div>

      {/* Preview & Edit Modal */}
      <PreviewDrawer
        bookmark={drawerPresence.mounted ? drawerBookmark : null}
        active={drawerPresence.active}
        captureEnabled={captureEnabled}
        onClose={() => setInspectingBookmark(null)}
        onRetry={handleRetryCapture}
        onDelete={handleDeleteBookmark}
        onUpdate={handleUpdateBookmark}
        onError={(msg) => showToast(msg, 'error', 3000)}
        onCopyUrl={handleCopyUrl}
        onVisit={(b) =>
          fetch(`/api/bookmarks/${b.id}/click`, { method: 'POST' }).catch(
            () => {},
          )
        }
        folders={folders}
      />

      {/* Toast Notification */}
      {toastPresence.mounted && (
        <div
          className={`fixed top-20 lg:top-16 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] flex items-center gap-2.5 px-4 py-2.5 bg-zinc-900 text-white rounded-xl shadow-lg border border-zinc-800 text-xs font-medium transition-all ease-out ${
            toastPresence.active
              ? 'opacity-100 translate-y-0 duration-200'
              : 'opacity-0 -translate-y-3 duration-150'
          }`}
        >
          {toast.type === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          ) : toast.type === 'error' ? (
            <span className="w-2 h-2 rounded-full bg-red-400" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* In-App Delete Modal */}
      {deleteModal.mounted && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-2xs transition-opacity ${
            deleteModal.active
              ? 'opacity-100 duration-300 ease-out'
              : 'opacity-0 duration-150 ease-in'
          }`}
        >
          <div
            className={`bg-white rounded-2xl p-6 max-w-sm w-full border border-zinc-200 shadow-2xl space-y-4 transition ${
              deleteModal.active
                ? 'opacity-100 scale-100 translate-y-0 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
                : 'opacity-0 scale-[0.94] translate-y-3 duration-150 ease-in'
            }`}
          >
            <h4 className="text-sm font-bold text-zinc-900">
              {activeView === 'trash'
                ? 'Permanently Delete?'
                : 'Move to Trash?'}
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {activeView === 'trash'
                ? 'This bookmark will be erased permanently from disk.'
                : 'Bookmark will be moved to Trash. You can restore it anytime.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="px-4 py-2 pointer-coarse:min-h-11 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!pendingDeleteId}
                onClick={() =>
                  pendingDeleteId && confirmDelete(pendingDeleteId)
                }
                className="px-4 py-2 pointer-coarse:min-h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                {activeView === 'trash'
                  ? 'Delete Permanently'
                  : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Folder Modal (No browser confirm alert!) */}
      {folderModal.mounted && pendingDeleteFolder && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-2xs transition-opacity ${
            folderModal.active
              ? 'opacity-100 duration-300 ease-out'
              : 'opacity-0 duration-150 ease-in'
          }`}
        >
          <div
            className={`bg-white rounded-2xl p-6 max-w-sm w-full border border-zinc-200 shadow-2xl space-y-4 transition ${
              folderModal.active
                ? 'opacity-100 scale-100 translate-y-0 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
                : 'opacity-0 scale-[0.94] translate-y-3 duration-150 ease-in'
            }`}
          >
            <h4 className="text-sm font-bold text-zinc-900">
              Delete Collection?
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Delete &quot;{pendingDeleteFolder.name}&quot;? Bookmarks in this
              collection will not be deleted, they will simply be unassigned.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingDeleteFolder(null)}
                className="px-4 py-2 pointer-coarse:min-h-11 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = pendingDeleteFolder.id;
                  setPendingDeleteFolder(null);
                  await handleDeleteFolder(id);
                }}
                className="px-4 py-2 pointer-coarse:min-h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Delete Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
