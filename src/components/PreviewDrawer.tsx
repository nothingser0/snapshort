import React, { useState, useEffect } from 'react';
import type { BookmarkWithTags } from '@/db/schema';
import { 
  X, 
  ExternalLink, 
  Calendar, 
  Globe, 
  Tag, 
  RefreshCw, 
  Trash2, 
  Check, 
  Edit3,
  AlertCircle 
} from 'lucide-react';

interface PreviewDrawerProps {
  bookmark: BookmarkWithTags | null;
  onClose: () => void;
  onRetry: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onUpdate: (id: string, data: { title?: string; url?: string; description?: string; tag_names?: string[] }) => Promise<void>;
}

export function PreviewDrawer({
  bookmark,
  onClose,
  onRetry,
  onDelete,
  onUpdate,
}: PreviewDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bookmark) {
      setTitle(bookmark.title || '');
      setUrl(bookmark.url || '');
      setDescription(bookmark.description || '');
      setTagInput(bookmark.tags.map(t => t.name).join(', '));
      setIsEditing(false);
    }
  }, [bookmark]);

  if (!bookmark) return null;

  const domain = (() => {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, '');
    } catch {
      return bookmark.url;
    }
  })();

  const fullDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(bookmark.created_at));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedTags = tagInput.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      await onUpdate(bookmark.id, {
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
        tag_names: parsedTags,
      });
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-[36px] shadow-2xl border border-zinc-200/80 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-4.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/60">
          <div className="flex items-center gap-2.5">
            {bookmark.favicon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bookmark.favicon_url} alt="" className="w-4 h-4 rounded-full" />
            ) : (
              <Globe className="w-4 h-4 text-zinc-400" />
            )}
            <span className="text-xs font-bold text-zinc-700">{domain}</span>
            <span className="text-zinc-300">•</span>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                bookmark.capture_status === 'ready'
                  ? 'bg-emerald-100 text-emerald-800'
                  : bookmark.capture_status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {bookmark.capture_status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Bookmark'}</span>
            </button>

            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>Visit Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-7 space-y-6">
          {/* Screenshot Preview */}
          <div className="rounded-[28px] overflow-hidden bg-zinc-100 border border-zinc-200/70 shadow-inner">
            {bookmark.capture_status === 'ready' && bookmark.screenshot_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bookmark.screenshot_path}
                alt={bookmark.title}
                className="w-full h-auto object-cover max-h-[460px]"
              />
            ) : (
              <div className="py-24 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-zinc-400 mx-auto" />
                <p className="text-xs font-semibold text-zinc-500">
                  {bookmark.capture_status === 'failed'
                    ? bookmark.capture_error || 'Screenshot generation failed'
                    : 'Screenshot is generating...'}
                </p>
                {bookmark.capture_status === 'failed' && (
                  <button
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

          {/* Edit Form or Metadata Display */}
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4 bg-zinc-50 p-6 rounded-[28px] border border-zinc-200/70">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Bookmark Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Destination URL
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add notes about why you saved this bookmark..."
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="tech, research, design"
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200 rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-zinc-900 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-zinc-800"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-zinc-900 leading-snug tracking-tight">{bookmark.title}</h2>
                <p className="text-xs text-zinc-400 font-mono break-all mt-1">{bookmark.url}</p>
              </div>

              {bookmark.description ? (
                <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                  {bookmark.description}
                </p>
              ) : (
                <p className="text-xs text-zinc-400 italic bg-zinc-50/50 p-3 rounded-2xl border border-dashed border-zinc-200">
                  No description added yet. Click &quot;Edit Bookmark&quot; to add notes.
                </p>
              )}

              {/* Tags & Full Indonesian Timestamp */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-100 text-xs">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-zinc-400" />
                  {bookmark.tags && bookmark.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {bookmark.tags.map((t) => (
                        <span
                          key={t.id}
                          className="bg-zinc-100 text-zinc-700 px-3 py-1 rounded-full font-bold text-[11px]"
                        >
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="italic text-zinc-400">No tags</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-zinc-500 font-medium text-xs">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Disimpan pada {fullDate}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 bg-zinc-50/60 border-t border-zinc-100 flex items-center justify-between">
          <button
            onClick={(e) => {
              onDelete(bookmark.id, e);
              onClose();
            }}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Bookmark</span>
          </button>

          <button
            onClick={(e) => onRetry(bookmark.id, e)}
            className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-capture Screenshot</span>
          </button>
        </div>
      </div>
    </div>
  );
}
