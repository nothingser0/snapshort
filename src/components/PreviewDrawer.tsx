import React, { useState, useEffect, useRef } from 'react';
import type { BookmarkWithTags } from '@/db/schema';
import { usePresence } from '@/lib/usePresence';
import {
  X,
  ExternalLink,
  RefreshCw,
  Trash2,
  AlertCircle,
  Check,
  Type,
  Link2,
  Tag as TagIcon,
  AlignLeft,
  Folder,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { FIELD_CLASS } from '@/lib/ui';

interface PreviewDrawerProps {
  bookmark: BookmarkWithTags | null;
  onClose: () => void;
  onRetry: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onUpdate: (
    id: string,
    data: {
      title?: string;
      url?: string;
      description?: string;
      tag_names?: string[];
      folder_id?: string | null;
    }
  ) => Promise<void>;
  onError?: (msg: string) => void;
  onCopyUrl?: (url: string, e: React.MouseEvent) => void;
  /** Called when the user actually opens the site from the drawer. */
  onVisit?: (bookmark: BookmarkWithTags) => void;
  folders?: Array<{ id: string; name: string; parent_id?: string | null }>;
  /** Drives the enter/exit transition; the parent keeps the drawer mounted while false. */
  active?: boolean;
}

export function PreviewDrawer({
  bookmark,
  onClose,
  onRetry,
  onDelete,
  onUpdate,
  onError,
  onCopyUrl,
  onVisit,
  folders = [],
  active = true,
}: PreviewDrawerProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const skipSaveRef = useRef(false);
  const collectionRef = useRef<HTMLDivElement>(null);

  // Re-seed the editable fields whenever a different bookmark opens (or the same
  // one reopens). Deriving during render keeps the first paint correct, instead
  // of showing the previous bookmark's values for one frame.
  const [syncedFrom, setSyncedFrom] = useState<string | null>(null);
  const syncKey = bookmark
    ? `${bookmark.id}:${active ? 'open' : 'closed'}`
    : null;
  if (bookmark && syncKey !== syncedFrom) {
    setSyncedFrom(syncKey);
    setTitle(bookmark.title || '');
    setUrl(bookmark.url || '');
    setDescription(bookmark.description || '');
    setTagInput(bookmark.tags.map((t) => t.name).join(', '));
    setFolderId(bookmark.folder_id || null);
    setCollectionOpen(false);
  }

  // Reset the "skip auto-save" flag whenever a new bookmark opens.
  useEffect(() => {
    skipSaveRef.current = false;
  }, [bookmark]);

  // Close the collection dropdown on outside click
  useEffect(() => {
    if (!collectionOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!collectionRef.current?.contains(e.target as Node)) {
        setCollectionOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [collectionOpen]);

  const dropdownPresence = usePresence(collectionOpen, 120);

  // Auto-save on close: only fires PATCH when something actually changed
  const handleClose = async () => {
    const current = bookmark;
    if (!current) {
      onClose();
      return;
    }
    if (!skipSaveRef.current) {
      const parsedTags = tagInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      const originalTags = current.tags.map((t) => t.name);
      const originalDescription = current.description || '';
      const isDirty =
        title.trim() !== current.title ||
        url.trim() !== current.url ||
        description.trim() !== originalDescription ||
        (folderId || null) !== (current.folder_id || null) ||
        parsedTags.join('|') !== originalTags.join('|');

      if (isDirty) {
        try {
          await onUpdate(current.id, {
            title: title.trim(),
            url: url.trim(),
            description: description.trim() || undefined,
            tag_names: parsedTags,
            folder_id: folderId,
          });
        } catch (err: unknown) {
          onError?.(
            err instanceof Error ? err.message : 'Failed to update bookmark'
          );
        }
      }
    }
    onClose();
  };

  // Esc closes the drawer through the same auto-save path
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (collectionOpen) {
          setCollectionOpen(false);
          return;
        }
        void handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!bookmark) return null;

  const domain = (() => {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, '');
    } catch {
      return bookmark.url;
    }
  })();

  const fullDate = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(bookmark.created_at));

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-zinc-950/40 backdrop-blur-sm transition-opacity ${
        active
          ? 'opacity-100 duration-300 ease-out'
          : 'opacity-0 duration-150 ease-in'
      }`}
    >
      <div
        className={`relative w-full max-w-6xl bg-white rounded-none sm:rounded-[28px] shadow-2xl border-0 sm:border border-zinc-200/80 overflow-hidden flex flex-col h-full sm:h-auto max-h-none sm:max-h-[90vh] transition ${
          active
            ? 'opacity-100 scale-100 translate-y-0 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
            : 'opacity-0 scale-[0.94] translate-y-3 duration-150 ease-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-b border-zinc-100 flex items-center justify-between gap-3 bg-zinc-50/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {bookmark.favicon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bookmark.favicon_url}
                alt=""
                className="w-4 h-4 rounded-full"
              />
            ) : (
              <span className="w-4 h-4 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-[10px] font-black uppercase">
                {domain.charAt(0)}
              </span>
            )}
            <span className="text-xs font-bold text-zinc-700 truncate">
              {domain}
            </span>
            {/* The saved date is supporting detail; it yields on narrow screens. */}
            <span className="hidden sm:inline text-zinc-300">•</span>
            <span className="hidden sm:inline text-[10px] font-semibold text-zinc-400 shrink-0">
              Saved {fullDate}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onVisit?.(bookmark)}
              className="px-3.5 py-2 sm:py-1.5 pointer-coarse:min-h-11 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
            >
              <span>Visit Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => void handleClose()}
              className="p-1.5 pointer-coarse:p-3 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: Live Preview on the left, editable fields on the right */}
        <form
          id="bookmark-edit-form"
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6 items-start">
            {/* Left: Screenshot Preview */}
            <div className="space-y-3">
              <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/70 relative">
                {bookmark.capture_status === 'ready' &&
                bookmark.screenshot_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bookmark.screenshot_path}
                    alt={bookmark.title}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-3 px-6">
                    <AlertCircle className="w-9 h-9 text-zinc-400 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-500">
                      {bookmark.capture_status === 'failed'
                        ? bookmark.capture_error ||
                          'Screenshot generation failed'
                        : 'Screenshot is generating...'}
                    </p>
                    {bookmark.capture_status === 'failed' && (
                      <button
                        type="button"
                        onClick={(e) => onRetry(bookmark.id, e)}
                        className="px-4 py-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-full inline-flex items-center gap-1.5 hover:bg-zinc-800"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Capture</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Quick actions: copy is the only action not already in the header
                  or footer, and the visit count is shown nowhere else. */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={(e) => onCopyUrl?.(bookmark.url, e)}
                  className="px-3 py-1.5 pointer-coarse:min-h-11 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 ease-out active:scale-95 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </button>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {bookmark.click_count ?? 0} visits
                </span>
              </div>
            </div>

            {/* Right: Editable Fields */}
            <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 flex flex-col gap-4 h-full">
              <div>
                <label className="block text-[10px] pointer-coarse:text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Title
                </label>
                <div className="relative">
                  <Type className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Bookmark title"
                    className={`w-full pl-8 pr-3 py-2 pointer-coarse:min-h-11 text-xs font-medium ${FIELD_CLASS}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] pointer-coarse:text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Collection
                </label>
                <div className="relative" ref={collectionRef}>
                  <button
                    type="button"
                    onClick={() => setCollectionOpen((open) => !open)}
                    className={`w-full flex items-center pl-8 pr-8 py-2 pointer-coarse:min-h-11 text-xs font-medium text-left cursor-pointer ${FIELD_CLASS}`}
                  >
                    <Folder className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <span className="truncate">
                      {folders.find((f) => f.id === folderId)?.name ||
                        'No collection'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition duration-150 ${
                        collectionOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {dropdownPresence.mounted && (
                    <div
                      className={`absolute z-10 mt-1.5 w-full rounded-xl border border-zinc-200 bg-white shadow-lg p-1 max-h-56 overflow-y-auto custom-scrollbar origin-top transition duration-150 ease-out ${
                        dropdownPresence.active
                          ? 'opacity-100 scale-100 -translate-y-0'
                          : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                      }`}
                    >
                      {[
                        { id: '', name: 'No collection', isChild: false },
                        ...folders
                          .filter((f) => !f.parent_id)
                          .flatMap((root) => [
                            { id: root.id, name: root.name, isChild: false },
                            ...folders
                              .filter((c) => c.parent_id === root.id)
                              .map((child) => ({
                                id: child.id,
                                name: child.name,
                                isChild: true,
                              })),
                          ]),
                      ].map((option) => {
                        const isSelected = (folderId || '') === option.id;
                        return (
                          <button
                            key={option.id || 'none'}
                            type="button"
                            onClick={() => {
                              setFolderId(option.id || null);
                              setCollectionOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-100 text-zinc-900'
                                : 'text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            <span
                              className={`truncate ${option.isChild ? 'pl-3 text-zinc-500' : ''}`}
                            >
                              {option.isChild
                                ? `↳ ${option.name}`
                                : option.name}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] pointer-coarse:text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  URL
                </label>
                <div className="relative">
                  <Link2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className={`w-full pl-8 pr-3 py-2 pointer-coarse:min-h-11 text-xs font-medium font-mono ${FIELD_CLASS}`}
                  />
                </div>
              </div>

              {/* Grows with the column so the form always matches the preview height */}
              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-[10px] pointer-coarse:text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <div className="relative flex-1 min-h-[96px]">
                  <AlignLeft className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add notes about why you saved this bookmark..."
                    className="absolute inset-0 w-full pl-8 pr-3 py-2 text-xs font-medium ${FIELD_CLASS} resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] pointer-coarse:text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Tags (comma separated)
                </label>
                <div className="relative">
                  <TagIcon className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="design, dev, reading"
                    className={`w-full pl-8 pr-3 py-2 pointer-coarse:min-h-11 text-xs font-medium ${FIELD_CLASS}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-zinc-50/60 border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                skipSaveRef.current = true;
                onDelete(bookmark.id, e);
                onClose();
              }}
              className="px-3.5 py-2 sm:py-1.5 pointer-coarse:min-h-11 text-red-600 hover:bg-red-50 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={(e) => onRetry(bookmark.id, e)}
              className="px-3.5 py-2 sm:py-1.5 pointer-coarse:min-h-11 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-capture</span>
            </button>
          </div>

          <span className="hidden lg:inline text-[11px] font-medium text-zinc-400">
            Changes save automatically when you close
          </span>
        </div>
      </div>
    </div>
  );
}
