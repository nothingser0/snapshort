'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { BentoGrid } from '@/components/BentoGrid';
import { PreviewDrawer } from '@/components/PreviewDrawer';
import type { BookmarkWithTags, Tag } from '@/db/schema';
import { CheckCircle2, Sparkles, Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 6;

interface ToastState {
  show: boolean;
  message: string;
  type: 'loading' | 'success' | 'error';
}

export default function HomePage() {
  const [bookmarks, setBookmarks] = useState<BookmarkWithTags[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [inspectingBookmark, setInspectingBookmark] = useState<BookmarkWithTags | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: ToastState['type'] = 'success', duration = 4000) => {
    setToast({ show: true, message, type });
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
      if (activeTab === 'ready') params.set('status', 'ready');

      const res = await fetch(`/api/bookmarks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
        setTags(data.tags || []);
      }
    } catch {
      // Non-critical fetch error
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTag, activeTab]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Global Keyboard Shortcuts: '/' for search, 'n' or 'N' for Add URL
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if already typing in an input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (!isInput) {
        if (e.key === '/') {
          e.preventDefault();
          searchInputRef.current?.focus();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          urlInputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        searchInputRef.current?.blur();
        urlInputRef.current?.blur();
        setInspectingBookmark(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTag, activeTab]);

  useEffect(() => {
    const hasPending = bookmarks.some(
      (b) => b.capture_status === 'pending' || b.capture_status === 'capturing'
    );
    if (!hasPending) return;

    const timer = setInterval(() => {
      fetchBookmarks();
    }, 2500);

    return () => clearInterval(timer);
  }, [bookmarks, fetchBookmarks]);

  const handleAddBookmark = async (url: string, tagNames: string[]) => {
    showToast('Menyimpan link & memulai render screenshot...', 'loading', 0);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tag_names: tagNames }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add bookmark');
      }

      showToast('Link tersimpan! Screenshot sedang diproses di background.', 'success', 4000);
      await fetchBookmarks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan bookmark', 'error', 4000);
      throw err;
    }
  };

  const handleRetryCapture = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showToast('Memulai ulang capture screenshot...', 'loading', 3000);
    await fetch(`/api/bookmarks/${id}/retry`, { method: 'POST' });
    await fetchBookmarks();
  };

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/bookmarks/${id}/pin`, { method: 'POST' });
    showToast('Featured pinned bookmark diperbarui', 'success', 2500);
    await fetchBookmarks();
  };

  const handleDeleteBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hapus bookmark ini?')) return;
    await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
    if (inspectingBookmark?.id === id) {
      setInspectingBookmark(null);
    }
    showToast('Bookmark berhasil dihapus', 'success', 2500);
    await fetchBookmarks();
  };

  const handleUpdateBookmark = async (
    id: string,
    data: { title?: string; url?: string; description?: string; tag_names?: string[] }
  ) => {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menyimpan perubahan');
    }

    const resData = await res.json();
    setInspectingBookmark(resData.bookmark);
    showToast('Perubahan bookmark berhasil disimpan', 'success', 2500);
    await fetchBookmarks();
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(bookmarks.length / ITEMS_PER_PAGE));
  const paginatedBookmarks = bookmarks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const readyCount = bookmarks.filter((b) => b.capture_status === 'ready').length;

  return (
    <div className="min-h-screen bg-[#ECEEF2] p-4 lg:p-6 flex items-start justify-center font-sans antialiased">
      {/* Outer Layout Frame */}
      <div className="w-full max-w-[1580px] flex gap-5">
        {/* Card 4: Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          tags={tags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          totalCount={bookmarks.length}
          readyCount={readyCount}
        />

        {/* Main Workspace Column */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {/* Top Search & Ingestion Bar */}
          <div className="bg-white rounded-[32px] p-4.5 px-6 border border-zinc-200/70 shadow-xs">
            <Header
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddBookmark={handleAddBookmark}
              searchInputRef={searchInputRef}
              urlInputRef={urlInputRef}
            />
          </div>

          {/* Tag Filter Chip if active */}
          {selectedTag && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-xs text-zinc-500 font-medium">Filter tag aktif:</span>
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200/50">
                <span>#{selectedTag}</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="hover:text-emerald-950 ml-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Paginated Gapless Bento Grid */}
          <BentoGrid
            bookmarks={paginatedBookmarks}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalBookmarksCount={bookmarks.length}
            onPageChange={setCurrentPage}
            onSelectBookmark={(b) => setInspectingBookmark(b)}
            onRetryCapture={handleRetryCapture}
            onTogglePin={handleTogglePin}
            onDeleteBookmark={handleDeleteBookmark}
          />
        </div>
      </div>

      {/* Preview & Edit Modal */}
      <PreviewDrawer
        bookmark={inspectingBookmark}
        onClose={() => setInspectingBookmark(null)}
        onRetry={handleRetryCapture}
        onDelete={handleDeleteBookmark}
        onUpdate={handleUpdateBookmark}
      />

      {/* Floating Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-zinc-900 text-white rounded-2xl shadow-xl border border-zinc-800 text-xs font-bold animate-in slide-in-from-bottom-3 duration-200">
          {toast.type === 'loading' ? (
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          ) : toast.type === 'error' ? (
            <span className="w-2 h-2 rounded-full bg-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
