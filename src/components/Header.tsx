import React, { useState } from 'react';
import { Search, Plus, Loader2, Link2 } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddBookmark: (url: string, tags: string[]) => Promise<void>;
  onToast?: (msg: string, type: 'success' | 'error' | 'loading') => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  urlInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function Header({
  searchQuery,
  onSearchChange,
  onAddBookmark,
  onToast,
  searchInputRef,
  urlInputRef,
}: HeaderProps) {
  const [urlInput, setUrlInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validated here rather than with the `required` attribute, which would pop
    // the browser's own bubble instead of our toast.
    if (!urlInput.trim()) {
      onToast?.('Paste a link first', 'error');
      return;
    }

    setLoading(true);

    try {
      const parsedTags = tagInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await onAddBookmark(urlInput.trim(), parsedTags);
      setUrlInput('');
      setTagInput('');
    } catch {
      // Toast notification handles error
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="px-8 py-3.5 border-b border-zinc-200/80 flex items-center justify-between gap-4 bg-white select-none">
      {/* Left: Global Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search bookmarks, domains, tags... (/)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none transition-colors"
        />
      </div>

      {/* Quick Ingestion Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-xl flex-1 justify-end">
        <div className="relative flex-1 max-w-xs">
          <Link2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={urlInputRef}
            type="text"
            placeholder="Paste link to save (N)..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none transition-colors"
          />
        </div>

        <input
          type="text"
          placeholder="#tag"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          className="w-24 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none transition-colors hidden lg:block"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-3.5 h-[34px] bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 ease-out active:scale-95 cursor-pointer shrink-0 shadow-2xs"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>Save Link</span>
        </button>
      </form>
    </header>
  );
}
