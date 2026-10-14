import React, { useState, useEffect } from 'react';
import { Search, ArrowUpRight, Loader2 } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddBookmark: (url: string, tags: string[]) => Promise<void>;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  urlInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function Header({
  searchQuery,
  onSearchChange,
  onAddBookmark,
  searchInputRef,
  urlInputRef,
}: HeaderProps) {
  const [urlInput, setUrlInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const parsedTags = tagInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await onAddBookmark(urlInput.trim(), parsedTags);
      setUrlInput('');
      setTagInput('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      {/* Search Bar with '/' keyboard shortcut pill */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Cari bookmark, URL, atau tag..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-zinc-200/80 rounded-full text-xs font-semibold placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-2xs"
        />
        <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-100 border border-zinc-200/80 rounded shadow-2xs pointer-events-none">
          /
        </kbd>
      </div>

      {/* Quick Add URL Form with 'N' shortcut */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-xl flex-1 justify-end">
        <div className="relative flex-1 max-w-xs">
          <input
            ref={urlInputRef}
            type="text"
            required
            placeholder="Ketik website (cth. kompas.com)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full px-4 pr-9 py-2.5 bg-white border border-zinc-200/80 rounded-full text-xs font-semibold placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-2xs"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-100 border border-zinc-200/80 rounded shadow-2xs pointer-events-none">
            N
          </kbd>
        </div>

        <input
          type="text"
          placeholder="#tag"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          className="w-28 px-4 py-2.5 bg-white border border-zinc-200/80 rounded-full text-xs font-semibold placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-2xs hidden md:block"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-full text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <span>Snap URL</span>
              <div className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center">
                <ArrowUpRight className="w-3 h-3 text-white" />
              </div>
            </>
          )}
        </button>
      </form>

      {errorMsg && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
