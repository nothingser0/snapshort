import React, { useEffect, useState } from 'react';
import type { BookmarkWithTags } from '@/db/schema';
import { useCoarsePointer } from '@/lib/useMediaQuery';
import {
  ArrowUpRight,
  RefreshCw,
  Trash2,
  Globe,
  ChevronLeft,
  ChevronRight,
  Copy,
  Star,
  RotateCcw,
  Archive,
} from 'lucide-react';
import { FIELD_CLASS } from '@/lib/ui';

/** Fades content in when it mounts, so new pages and views settle instead of snapping. */
function FadeIn({
  children,
  className = 'min-h-0 h-full',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`${className} transition-opacity ease-out ${
        shown ? 'opacity-100 duration-150' : 'opacity-0 duration-150'
      }`}
    >
      {children}
    </div>
  );
}

interface BentoGridProps {
  bookmarks: BookmarkWithTags[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectBookmark: (bookmark: BookmarkWithTags) => void;
  onOpenExternal: (bookmark: BookmarkWithTags) => void;
  onRetryCapture: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onRestoreFromTrash?: (id: string, e: React.MouseEvent) => void;
  onToggleArchive: (id: string, e: React.MouseEvent) => void;
  onDeleteBookmark: (id: string, e: React.MouseEvent) => void;
  onCopyUrl: (url: string, e: React.MouseEvent) => void;
  onToast?: (msg: string, type: 'success' | 'error' | 'loading') => void;
  draggingBookmarkId?: string | null;
  onBookmarkDragStart?: (id: string) => void;
  onBookmarkDragEnd?: () => void;
}

export function BentoGrid({
  bookmarks,
  loading,
  currentPage,
  totalPages,
  onPageChange,
  onSelectBookmark,
  onOpenExternal,
  onRetryCapture,
  onToggleFavorite,
  onRestoreFromTrash,
  onToggleArchive,
  onDeleteBookmark,
  onCopyUrl,
  onToast,
  draggingBookmarkId = null,
  onBookmarkDragStart,
  onBookmarkDragEnd,
}: BentoGridProps) {
  // HTML5 drag-and-drop does not fire on touch screens, so cards are not marked
  // draggable there; moving a bookmark into a collection uses the editor's
  // Collection field instead.
  const coarsePointer = useCoarsePointer();
  const [jumpPageInput, setJumpPageInput] = useState('');

  // Card tags stay monochrome: color is reserved for status and actions
  const CARD_TAG_PILL_CLASS =
    'bg-zinc-100 text-zinc-600 border border-zinc-200/70';

  const handleJumpSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput.trim(), 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target);
      setJumpPageInput('');
    } else {
      onToast?.(
        `Invalid page number. Please enter a page between 1 and ${totalPages}.`,
        'error'
      );
      setJumpPageInput('');
    }
  };

  const getPaginationItems = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [
        1,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages,
    ];
  };

  const paginationItems = getPaginationItems();

  // UNIFORM CARD RENDERER: every card is exactly the same size (1 column x 1 row)
  const renderCard = (b: BookmarkWithTags) => {
    const isDeleted = b.is_deleted === 1;
    const isFav = b.is_favorite === 1;

    const domain = (() => {
      try {
        return new URL(b.url).hostname.replace(/^www\./, '');
      } catch {
        return b.url;
      }
    })();

    const cleanTitle = (() => {
      const raw = b.title?.trim();
      if (!raw || raw.startsWith('http://') || raw.startsWith('https://')) {
        return domain.charAt(0).toUpperCase() + domain.slice(1);
      }
      return raw;
    })();

    const dateStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(b.created_at));

    return (
      <div
        key={b.id}
        onClick={() => onSelectBookmark(b)}
        draggable={!coarsePointer}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', b.id);
          e.dataTransfer.effectAllowed = 'move';
          onBookmarkDragStart?.(b.id);
        }}
        onDragEnd={onBookmarkDragEnd}
        className={`bg-white rounded-2xl border ${
          isFav
            ? 'border-zinc-300 ring-2 ring-zinc-900/5 shadow-md'
            : 'border-zinc-200/80 shadow-xs'
        } hover:shadow-[0_16px_32px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-zinc-300 transition-all duration-200 ease-out cursor-grab active:cursor-grabbing group flex flex-col overflow-hidden lg:justify-between lg:min-h-0 lg:h-full ${
          draggingBookmarkId === b.id ? 'opacity-40' : ''
        }`}
      >
        {/* Viewport Screenshot */}
        <div className="w-full aspect-[16/10] lg:aspect-auto lg:flex-1 lg:min-h-0 bg-zinc-100 relative border-b border-zinc-100 flex items-center justify-center overflow-hidden">
          {b.capture_status === 'ready' && b.screenshot_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.screenshot_path}
              alt={cleanTitle}
              draggable={false}
              /* Synchronous decode: without it a card entering a view paints its
                 placeholder for a frame or two, which reads as a white blink. */
              decoding="sync"
              className="w-full h-full object-cover object-top transition duration-400 ease-out group-hover:scale-[1.04]"
            />
          ) : b.capture_status === 'capturing' ? (
            <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
              <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
              <span className="text-[10px] pointer-coarse:text-xs text-zinc-500 font-medium">
                Capturing preview...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center bg-zinc-50">
              <div className="w-7 h-7 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 shadow-2xs">
                <Globe className="w-4 h-4" />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] pointer-coarse:text-xs text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                <span>Offline</span>
              </span>
            </div>
          )}

          {/* Favicon & Domain Badge (Top Left) */}
          <div className="absolute top-2.5 left-2.5 z-2 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] pointer-coarse:text-[11px] font-bold text-zinc-800 shadow-2xs flex items-center gap-1.5 border border-white/80 max-w-[140px]">
            {b.favicon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.favicon_url}
                alt=""
                className="w-3.5 h-3.5 rounded-full shrink-0"
              />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-[8px] font-black uppercase shrink-0">
                {domain.charAt(0)}
              </span>
            )}
            <span className="truncate">{domain}</span>
          </div>

          {/* Favorite Action Button strictly in Top Right (Clean Monochrome Stroke SVG Icon) */}
          <button
            onClick={(e) => onToggleFavorite(b.id, e)}
            className={`absolute top-2.5 right-2.5 z-2 p-1 rounded-full transition-all duration-150 ease-out active:scale-125 cursor-pointer border shrink-0
              pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center ${
                isFav
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                  : 'bg-white/90 hover:bg-white text-zinc-400 hover:text-zinc-900 border-zinc-200/80 shadow-2xs opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100'
              }`}
            title={isFav ? 'Remove Favorite' : 'Add to Favorites'}
          >
            <Star
              className={`w-3 h-3 ${isFav ? 'text-white fill-white' : 'text-zinc-600'}`}
            />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex flex-col justify-between shrink-0 bg-white">
          <div>
            <h4 className="text-xs 2xl:text-sm font-bold text-zinc-900 line-clamp-1 leading-snug">
              {cleanTitle}
            </h4>

            {b.description ? (
              <p className="text-[11px] pointer-coarse:text-[13px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                {b.description}
              </p>
            ) : (
              <p className="text-[10px] pointer-coarse:text-xs text-zinc-400 font-mono truncate mt-0.5">
                {b.url}
              </p>
            )}

            {b.tags && b.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {b.tags.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    className={`text-[9px] pointer-coarse:text-xs font-semibold px-2 py-0.5 rounded-md ${CARD_TAG_PILL_CLASS}`}
                  >
                    #{t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 mt-2 text-[10px] pointer-coarse:text-xs text-zinc-400 font-medium">
            <span>{dateStr}</span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity duration-200 pointer-coarse:gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenExternal(b);
                }}
                className="p-1 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-all duration-150 ease-out active:scale-90 cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center"
                title="Visit website"
              >
                <ArrowUpRight className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => onCopyUrl(b.url, e)}
                className="p-1 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all duration-150 ease-out active:scale-90 cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center"
                title="Copy URL"
              >
                <Copy className="w-3 h-3" />
              </button>
              {isDeleted ? (
                <button
                  onClick={(e) => onRestoreFromTrash?.(b.id, e)}
                  className="p-1 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-all duration-150 ease-out active:scale-90 cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center"
                  title="Restore from Trash"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              ) : (
                <>
                  <button
                    onClick={(e) => onToggleArchive(b.id, e)}
                    className="p-1 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all duration-150 ease-out active:scale-90 cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center"
                    title={b.is_archived === 1 ? 'Unarchive' : 'Archive'}
                  >
                    <Archive className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryCapture(b.id, e);
                    }}
                    className="p-1 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all duration-150 ease-out active:scale-90 cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center"
                    title="Retry Screenshot"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => onDeleteBookmark(b.id, e)}
                className="p-1 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150 ease-out active:scale-90 cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center"
                title={isDeleted ? 'Delete Permanently' : 'Move to Trash'}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Every state below fills the same content slot so the layout never shifts.
  // The skeleton only covers the very first load; later refetches leave the
  // current cards untouched and swap them in one commit. Anything that faded the
  // cards in between (per-card fades, refetch dimming) showed up as a light
  // flicker on every menu switch.
  const showSkeleton = loading && bookmarks.length === 0;

  const content = showSkeleton ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:flex-1 lg:min-h-0 lg:[grid-template-rows:repeat(2,minmax(0,1fr))]">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="min-h-0 h-full bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col overflow-hidden animate-pulse"
        >
          {/* screenshot area */}
          <div className="w-full flex-1 min-h-0 bg-zinc-100" />
          <div className="p-4 space-y-2 shrink-0">
            <div className="h-3 w-2/3 rounded bg-zinc-200" />
            <div className="h-2.5 w-full rounded bg-zinc-100" />
            <div className="h-2.5 w-4/5 rounded bg-zinc-100" />
            <div className="flex gap-1 pt-1">
              <div className="h-4 w-12 rounded-md bg-zinc-100" />
              <div className="h-4 w-10 rounded-md bg-zinc-100" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <div className="h-2.5 w-10 rounded bg-zinc-100" />
              <div className="h-2.5 w-16 rounded bg-zinc-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : bookmarks.length === 0 ? (
    /* Centring comes from the flex parent: `h-full` on the child does not resolve
       inside a flex-grown box, which left the block sitting in the upper third. */
    <FadeIn className="flex-1 min-h-0 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm select-none">
        <div className="w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center mb-3 shadow-md shadow-zinc-900/10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Snapshort" className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-zinc-900 mb-1">
          No Bookmarks Found
        </h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          No items match this view or filter. Add a new link to begin.
        </p>
      </div>
    </FadeIn>
  ) : (
    /* UNIFORM GRID: 3 columns x 2 rows = 6 identical cards, every card 1x1 */
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:flex-1 lg:min-h-0 lg:[grid-template-rows:repeat(2,minmax(0,1fr))]">
      {bookmarks.slice(0, 6).map((b) => renderCard(b))}
    </div>
  );

  return (
    <div className="min-h-full lg:h-full flex flex-col justify-between gap-3 lg:min-h-0 select-none">
      {content}

      {/* Pagination Status & Controls */}
      <div className="hidden lg:flex items-center justify-between min-h-10 pt-2.5 border-t border-zinc-200/80 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 font-medium">
            Page {currentPage} of {totalPages}
          </span>

          {/* Direct jump: only meaningful when there are enough pages to need it */}
          {totalPages > 5 && (
            <form
              onSubmit={handleJumpSubmit}
              className="flex items-center gap-2"
            >
              <label
                htmlFor="jump-page-input"
                className="text-xs text-zinc-500 font-medium"
              >
                Go to page
              </label>
              <input
                id="jump-page-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder="—"
                className={`w-12 h-7 px-2 text-xs font-medium text-center ${FIELD_CLASS}`}
              />
            </form>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-white border border-zinc-200 rounded-full text-xs font-semibold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 flex items-center gap-1 shadow-2xs transition-all duration-150 ease-out active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {paginationItems.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-5 text-center text-xs font-bold text-zinc-400"
                  >
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(Number(p))}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition-all duration-150 ease-out active:scale-95 cursor-pointer ${
                    currentPage === p
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() =>
                onPageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage >= totalPages}
              className="px-3 py-1 bg-white border border-zinc-200 rounded-full text-xs font-semibold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 flex items-center gap-1 shadow-2xs transition-all duration-150 ease-out active:scale-95 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
