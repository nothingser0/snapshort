import React from 'react';
import type { BookmarkWithTags } from '@/db/schema';
import { ExternalLink, RefreshCw, Trash2, Globe, Clock, AlertCircle, Sparkles } from 'lucide-react';

interface BookmarkCardProps {
  bookmark: BookmarkWithTags;
  onSelect: (bookmark: BookmarkWithTags) => void;
  onRetry: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  variant?: 'default' | 'mint' | 'amber' | 'dark';
}

export function BookmarkCard({
  bookmark,
  onSelect,
  onRetry,
  onDelete,
  variant = 'default',
}: BookmarkCardProps) {
  const domain = (() => {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, '');
    } catch {
      return bookmark.url;
    }
  })();

  const timeAgo = (() => {
    const diff = Math.floor((Date.now() - bookmark.created_at) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  })();

  // Card theme variants matching Mindscope bento style
  const cardStyle = {
    default: 'bg-white text-gray-900 border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
    mint: 'bg-[#EAFBF3] text-emerald-950 border border-emerald-100/60 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.08)]',
    amber: 'bg-[#FEF7EA] text-amber-950 border border-amber-100/60 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.08)]',
    dark: 'bg-[#18191E] text-white border border-zinc-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.25)]',
  }[variant];

  const isDark = variant === 'dark';

  return (
    <div
      onClick={() => onSelect(bookmark)}
      className={`group relative rounded-[28px] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)] cursor-pointer flex flex-col ${cardStyle}`}
    >
      {/* Visual Preview Header (Top 55-60%) */}
      <div className="relative aspect-[16/10] w-full bg-gray-100 overflow-hidden">
        {bookmark.capture_status === 'ready' && bookmark.screenshot_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bookmark.screenshot_path}
            alt={bookmark.title}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : bookmark.capture_status === 'capturing' || bookmark.capture_status === 'pending' ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 gap-3 p-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <Sparkles className="w-4 h-4 text-emerald-600 absolute inset-0 m-auto" />
            </div>
            <span className="text-xs font-medium text-gray-500 animate-pulse tracking-wide">
              {bookmark.capture_status === 'capturing' ? 'Capturing visual preview...' : 'Queued for capture...'}
            </span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50/80 gap-2 p-6 text-center">
            <AlertCircle className="w-7 h-7 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Capture failed</span>
            <button
              onClick={(e) => onRetry(bookmark.id, e)}
              className="mt-1 px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-full shadow-xs border border-gray-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Top Badges overlay */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-gray-700 shadow-xs border border-white/60">
            {bookmark.favicon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bookmark.favicon_url} alt="" className="w-3.5 h-3.5 rounded-full" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="truncate max-w-[120px]">{domain}</span>
          </div>

          {bookmark.capture_status === 'ready' && (
            <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
              Live
            </span>
          )}
        </div>
      </div>

      {/* Content & Metadata Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3
              className={`text-sm font-semibold line-clamp-2 leading-snug tracking-tight ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {bookmark.title || bookmark.url}
            </h3>
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`p-1.5 rounded-full transition-colors shrink-0 ${
                isDark
                  ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
              }`}
              title="Open link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {bookmark.description && (
            <p className={`text-xs line-clamp-2 mb-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              {bookmark.description}
            </p>
          )}

          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {bookmark.tags.map((t) => (
                <span
                  key={t.id}
                  className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300'
                      : 'bg-white/80 text-gray-600 border border-gray-200/60'
                  }`}
                >
                  #{t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={`mt-4 pt-3 flex items-center justify-between text-[11px] border-t ${
          isDark ? 'border-zinc-800/80 text-zinc-500' : 'border-gray-100 text-gray-400'
        }`}>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => onRetry(bookmark.id, e)}
              className="p-1 rounded-full hover:bg-gray-200/50 hover:text-gray-700 transition-colors"
              title="Refresh screenshot"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => onDelete(bookmark.id, e)}
              className="p-1 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete bookmark"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
