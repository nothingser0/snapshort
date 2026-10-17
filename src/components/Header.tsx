import React, { useState } from 'react';
import { Search, Plus, Loader2, Link2, Menu } from 'lucide-react';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { FIELD_CLASS } from '@/lib/ui';

interface HeaderProps {
  /** Mobile only: opens the navigation drawer. */
  onOpenNav?: () => void;
  /** Mobile only: whether the paste-link row is revealed. */
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddBookmark: (url: string, tags: string[]) => Promise<void>;
  onToast?: (msg: string, type: 'success' | 'error' | 'loading') => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  urlInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function Header({
  onOpenNav,
  addOpen = false,
  onAddOpenChange,
  searchQuery,
  onSearchChange,
  onAddBookmark,
  onToast,
  searchInputRef,
  urlInputRef,
}: HeaderProps) {
  // Keyboard hints are meaningless on a touch keyboard, so they only appear
  // where a physical keyboard is likely.
  const isDesktop = useIsDesktop();
  const [urlInput, setUrlInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  /** Opens the sheet on a clean slate: leftovers from a dismissed attempt should
   *  not reappear, and the first field takes focus once it is on screen. */
  const openAdd = () => {
    setUrlInput('');
    setTagInput('');
    onAddOpenChange?.(true);
    requestAnimationFrame(() => urlInputRef?.current?.focus());
  };

  const closeAdd = () => onAddOpenChange?.(false);

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
      // On a phone the row collapses again once the link is on its way.
      if (!isDesktop) onAddOpenChange?.(false);
    } catch {
      // Toast notification handles error
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="px-4 sm:px-6 lg:px-8 py-3 lg:py-3.5 border-b border-zinc-200/80 bg-white select-none shrink-0">
      {/* One row from lg up; on phones the two groups stack so neither is squeezed. */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 lg:gap-4">
        <div className="flex items-center gap-2.5 lg:flex-1">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="Open navigation"
            className="lg:hidden shrink-0 w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 -ml-1 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          {/* Global Search Bar */}
          <div className="relative flex-1 lg:max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                isDesktop
                  ? 'Search bookmarks, domains, tags... (/)'
                  : 'Search bookmarks...'
              }
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`w-full pl-9 pr-3 h-9 lg:h-[34px] pointer-coarse:h-11 text-xs font-medium ${FIELD_CLASS}`}
            />
          </div>

          {/* Reveals the paste-link row; the row is always visible on desktop. */}
          <button
            type="button"
            onClick={() => (addOpen ? closeAdd() : openAdd())}
            aria-expanded={addOpen}
            aria-label={addOpen ? 'Hide add link field' : 'Add bookmark'}
            className={`lg:hidden shrink-0 w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg border flex items-center justify-center transition-colors duration-150 ease-out active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
              addOpen
                ? 'bg-white border-zinc-300 text-zinc-900 hover:bg-zinc-100'
                : 'bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800 shadow-2xs'
            }`}
          >
            <Plus
              className={`w-4 h-4 transition-transform duration-200 ${
                addOpen ? 'rotate-45' : ''
              }`}
            />
          </button>
        </div>

        {/* Add bookmark. Desktop keeps the inline row; phones get a bottom sheet,
            where two fields and a submit button have room to stack. One form
            serves both — only its positioning changes at `lg`. */}
        <button
          type="button"
          aria-label="Close add bookmark"
          tabIndex={addOpen ? 0 : -1}
          onClick={closeAdd}
          className={`lg:hidden fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-2xs transition-opacity duration-200 ${
            addOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        <form
          onSubmit={handleSubmit}
          inert={!addOpen && !isDesktop ? true : undefined}
          className={`fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 bg-white border-t border-zinc-200 rounded-t-3xl px-4 pt-3 pb-6 shadow-2xl transition-transform duration-300 ease-out
            lg:static lg:z-auto lg:max-w-xl lg:flex-1 lg:flex-row lg:items-center lg:justify-end lg:gap-2 lg:translate-y-0 lg:rounded-none lg:border-0 lg:p-0 lg:bg-transparent lg:shadow-none
            ${addOpen ? 'translate-y-0' : 'translate-y-full'}`}
        >
          {/* Sheet grab handle */}
          <div
            aria-hidden
            className="lg:hidden mx-auto mb-1 h-1 w-10 rounded-full bg-zinc-300"
          />

          <div className="relative lg:max-w-xs lg:flex-1">
            <Link2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={urlInputRef}
              type="text"
              placeholder={
                isDesktop ? 'Paste link to save (N)...' : 'Paste link...'
              }
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className={`w-full pl-8 pr-3 h-9 lg:h-[34px] pointer-coarse:h-11 text-xs font-medium ${FIELD_CLASS}`}
            />
          </div>

          <input
            type="text"
            placeholder="#tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className={`w-full lg:w-24 px-3 h-9 lg:h-[34px] pointer-coarse:h-11 text-xs font-medium ${FIELD_CLASS}`}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full justify-center lg:w-auto px-3.5 h-9 lg:h-[34px] pointer-coarse:h-11 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 ease-out active:scale-95 cursor-pointer shrink-0 shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Save Link</span>
            <span className="sm:hidden">Add bookmark</span>
          </button>
        </form>
      </div>
    </header>
  );
}
