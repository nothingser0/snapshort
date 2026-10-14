import React from 'react';
import type { BookmarkWithTags } from '@/db/schema';
import { 
  ArrowUpRight, 
  RefreshCw, 
  Trash2, 
  Globe, 
  Pin, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface BentoGridProps {
  bookmarks: BookmarkWithTags[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalBookmarksCount: number;
  onPageChange: (page: number) => void;
  onSelectBookmark: (bookmark: BookmarkWithTags) => void;
  onRetryCapture: (id: string, e: React.MouseEvent) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onDeleteBookmark: (id: string, e: React.MouseEvent) => void;
}

export function BentoGrid({
  bookmarks,
  loading,
  currentPage,
  totalPages,
  totalBookmarksCount,
  onPageChange,
  onSelectBookmark,
  onRetryCapture,
  onTogglePin,
  onDeleteBookmark,
}: BentoGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3.5 auto-rows-[115px] animate-pulse">
        <div className="col-span-1 row-span-1 bg-white rounded-[28px] border border-zinc-200/70" />
        <div className="col-span-1 row-span-1 bg-white rounded-[28px] border border-zinc-200/70" />
        <div className="col-span-2 row-span-1 bg-white rounded-[28px] border border-zinc-200/70" />
        <div className="col-span-2 row-span-2 bg-white rounded-[28px] border border-zinc-200/70" />
        <div className="col-span-2 row-span-2 bg-white rounded-[28px] border border-zinc-200/70" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="bg-white rounded-[32px] p-10 text-center border border-zinc-200/70 shadow-xs max-w-lg mx-auto my-6">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
        <h3 className="text-sm font-bold text-zinc-900 mb-1">Visual Vault Kosong</h3>
        <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
          Tempel URL website di kolom atas atau tekan <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px] font-mono">N</kbd> untuk quick save.
        </p>
      </div>
    );
  }

  const slotCoordinates = [
    { gridColumn: '1 / 3', gridRow: '2 / 4', isHorizontal: false, isHero: true },
    { gridColumn: '3 / 5', gridRow: '2 / 4', isHorizontal: true, isHero: false },
    { gridColumn: '1 / 2', gridRow: '4 / 6', isHorizontal: false, isHero: false },
    { gridColumn: '2 / 4', gridRow: '4 / 5', isHorizontal: true, isHero: false },
    { gridColumn: '4 / 5', gridRow: '4 / 6', isHorizontal: false, isHero: false },
    { gridColumn: '2 / 4', gridRow: '5 / 6', isHorizontal: true, isHero: false },
  ];

  return (
    <div className="space-y-4">
      {/* 4-Column Interlocking Mosaic Puzzle */}
      <div 
        className="grid grid-cols-4 gap-3.5"
        style={{
          gridTemplateRows: 'repeat(5, 115px)',
        }}
      >
        {/* Row 1, Col 1: Active Links Mint Card (1x1) */}
        <div 
          style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}
          className="bg-[#E4FBF1] rounded-[28px] p-4 border border-emerald-200/60 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">Active Links</span>
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-emerald-950 tracking-tight leading-none">
              {totalBookmarksCount}
            </span>
            <p className="text-[10px] text-emerald-800/80 font-bold mt-0.5">Saved in database</p>
          </div>
        </div>

        {/* Row 1, Col 2: Ready Previews Peach Card (1x1) */}
        <div 
          style={{ gridColumn: '2 / 3', gridRow: '1 / 2' }}
          className="bg-[#FEF5E7] rounded-[28px] p-4 border border-amber-200/60 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-950 uppercase tracking-wider">Ready Previews</span>
            <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-amber-950 tracking-tight leading-none">
              {bookmarks.filter((b) => b.capture_status === 'ready').length}
            </span>
            <p className="text-[10px] text-amber-800/80 font-bold mt-0.5">Rendered thumbnails</p>
          </div>
        </div>

        {/* Row 1, Col 3-4: Engine Status Dark Card (2x1) */}
        <div 
          style={{ gridColumn: '3 / 5', gridRow: '1 / 2' }}
          className="bg-[#18191E] text-white rounded-[28px] p-4 border border-zinc-800 shadow-xs flex items-center justify-between"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Engine Status</span>
            </div>
            <h4 className="text-xs font-bold text-zinc-100">Chromium Headless Daemon</h4>
            <p className="text-[10px] text-zinc-400 font-mono">Concurrency: 2 • SQLite WAL</p>
          </div>
          <div className="px-3 py-1 bg-zinc-800/80 rounded-full border border-zinc-700/60 text-[11px] font-bold text-emerald-400 font-mono">
            ONLINE
          </div>
        </div>

        {/* 6 Interlocking Bookmark Cards */}
        {bookmarks.slice(0, 6).map((bookmark, index) => {
          const isPinned = bookmark.is_pinned === 1;
          const slot = slotCoordinates[index] || {
            gridColumn: 'auto',
            gridRow: 'auto',
            isHorizontal: false,
            isHero: false,
          };

          const domain = (() => {
            try {
              return new URL(bookmark.url).hostname.replace(/^www\./, '');
            } catch {
              return bookmark.url;
            }
          })();

          const cleanDisplayTitle = (() => {
            const raw = bookmark.title?.trim();
            if (!raw || raw.startsWith('http://') || raw.startsWith('https://')) {
              return domain.charAt(0).toUpperCase() + domain.slice(1);
            }
            return raw;
          })();

          const fullDate = new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(bookmark.created_at));

          return (
            <div
              key={bookmark.id}
              style={{
                gridColumn: slot.gridColumn,
                gridRow: slot.gridRow,
              }}
              onClick={() => onSelectBookmark(bookmark)}
              className={`bg-white rounded-[28px] p-3.5 border border-zinc-200/70 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer group flex ${
                slot.isHorizontal ? 'flex-row items-center gap-4' : 'flex-col justify-between'
              } overflow-hidden`}
            >
              {/* Thumbnail Viewport with Polished Fallback Graphic */}
              <div
                className={`${
                  slot.isHorizontal
                    ? 'w-[45%] h-full shrink-0'
                    : slot.isHero
                    ? 'w-full h-32 shrink-0 mb-2'
                    : 'w-full h-28 shrink-0 mb-1.5'
                } rounded-[18px] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-100 relative border border-zinc-200/60 flex items-center justify-center`}
              >
                {bookmark.capture_status === 'ready' && bookmark.screenshot_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bookmark.screenshot_path}
                    alt={cleanDisplayTitle}
                    className="w-full h-full object-cover object-top group-hover:scale-102 transition-transform duration-300"
                  />
                ) : bookmark.capture_status === 'capturing' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center bg-zinc-50/80">
                    <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-[10px] text-zinc-500 font-semibold tracking-wide">Capturing...</span>
                  </div>
                ) : (
                  // Elegant Fallback Graphic for Failed / Inaccessible Webpages
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-3 text-center bg-gradient-to-b from-zinc-50/50 to-zinc-100/80">
                    <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 shadow-2xs">
                      <Globe className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 truncate max-w-[120px]">
                      {domain}
                    </span>
                    <span className="text-[9px] text-zinc-400">Offline / Timeout</span>
                  </div>
                )}

                {/* Favicon & Domain Badge */}
                <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-bold text-zinc-800 shadow-2xs flex items-center gap-1 border border-white/60">
                  {bookmark.favicon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bookmark.favicon_url} alt="" className="w-3 h-3 rounded-full" />
                  ) : (
                    <Globe className="w-3 h-3 text-zinc-400" />
                  )}
                  <span className="truncate max-w-[90px]">{domain}</span>
                </div>

                {/* Pin Action Button */}
                <button
                  onClick={(e) => onTogglePin(bookmark.id, e)}
                  className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    isPinned
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs'
                      : 'bg-white/80 hover:bg-white text-zinc-400 hover:text-zinc-800 border border-zinc-200/60'
                  }`}
                  title={isPinned ? 'Unpin bookmark' : 'Pin as Featured'}
                >
                  <Pin className={`w-2 h-2 ${isPinned ? 'fill-emerald-700 text-emerald-700' : ''}`} />
                  <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                </button>
              </div>

              {/* Content Details */}
              <div className="flex-1 flex flex-col justify-between min-w-0 h-full py-0.5">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 line-clamp-1 leading-snug group-hover:text-emerald-700 transition-colors">
                    {cleanDisplayTitle}
                  </h4>

                  {bookmark.description ? (
                    <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                      {bookmark.description}
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                      {bookmark.url}
                    </p>
                  )}

                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {bookmark.tags.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="text-[9px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full"
                        >
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom metadata */}
                <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 mt-1 text-[9px] text-zinc-400 font-medium">
                  <span className="truncate">{fullDate}</span>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryCapture(bookmark.id, e);
                      }}
                      className="p-1 hover:text-zinc-800 cursor-pointer"
                      title="Retry Screenshot"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBookmark(bookmark.id, e);
                      }}
                      className="p-1 hover:text-red-600 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-3 border-t border-zinc-200/60">
          <span className="text-xs font-bold text-zinc-500">
            Halaman {currentPage} dari {totalPages} ({totalBookmarksCount} total link)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3.5 py-1.5 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  currentPage === p
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3.5 py-1.5 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
