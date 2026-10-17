import React, { useEffect, useRef, useState } from 'react';
import { FlipList } from './FlipList';
import { useCoarsePointer } from '@/lib/useMediaQuery';
import {
  Compass,
  Clock,
  Tag as TagIcon,
  Bookmark,
  GripVertical,
  Star,
  Archive,
  Trash2,
  Folder,
  FolderPlus,
  ArrowDownAZ,
  ArrowDown10,
  CornerDownRight,
  Edit2,
  Trash,
  Check,
  X,
} from 'lucide-react';
import { FIELD_CLASS } from '@/lib/ui';

export type MainView = 'all' | 'favorites' | 'recent' | 'archive' | 'trash';

// Dragged to the bookmarks bar, the browser names the entry after this link text
// and borrows the page favicon for its icon, so keep the label as the product name.
const BOOKMARKLET_CODE = `javascript:(function(){var u=encodeURIComponent(location.href);var t=encodeURIComponent(document.title||'');window.open('http://localhost:3000/?add_url='+u+'&add_title='+t,'_blank');})();`;

// Drop-target id for "no collection"; real ids are UUIDs so there is no clash.
const NO_COLLECTION = 'no-collection';

interface SidebarProps {
  activeView: MainView;
  onSelectView: (view: MainView) => void;
  folders: Array<{
    id: string;
    name: string;
    parent_id: string | null;
    count?: number;
  }>;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onRequestDeleteFolder: (id: string, name: string) => void;
  tags: Array<{ id: string; name: string; color?: string; count?: number }>;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  draggingBookmarkId?: string | null;
  onAssignBookmarkToFolder?: (
    bookmarkId: string,
    folderId: string | null
  ) => void;
  counts: {
    all: number;
    favorites: number;
    recent: number;
    archive: number;
    trash: number;
  };
  /** Mobile only: the sidebar is an off-canvas drawer below the `lg` breakpoint. */
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeView,
  onSelectView,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onRequestDeleteFolder,
  tags,
  selectedTag,
  onSelectTag,
  draggingBookmarkId = null,
  onAssignBookmarkToFolder,
  counts,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeParentFolderId, setActiveParentFolderId] = useState<
    string | null
  >(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const coarsePointer = useCoarsePointer();
  const [sortFoldersByCount, setSortFoldersByCount] = useState(false);
  const [sortTagsByCount, setSortTagsByCount] = useState(false);

  // Clear the highlight when the drag finishes, wherever it ended. Derived during
  // render so the highlight cannot outlive the drag by a frame.
  if (!draggingBookmarkId && dropTargetId !== null) setDropTargetId(null);

  // Bookmark cards can be dragged onto a collection to file them, or onto the
  // "no collection" target to pull them back out.
  const dragOverProps = (targetId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      // Keyed off the payload rather than React state so a drop is never
      // rejected because a state update has not landed yet.
      if (!e.dataTransfer.types.includes('text/plain')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTargetId !== targetId) setDropTargetId(targetId);
    },
    onDragLeave: (e: React.DragEvent) => {
      const related = e.relatedTarget as Node | null;
      // Chromium reports a null relatedTarget for drag events; the next
      // dragenter/dragover corrects the highlight, so only real leaves clear it.
      if (!related || e.currentTarget.contains(related)) return;
      setDropTargetId((current) => (current === targetId ? null : current));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const bookmarkId = e.dataTransfer.getData('text/plain');
      setDropTargetId(null);
      if (bookmarkId) {
        onAssignBookmarkToFolder?.(
          bookmarkId,
          targetId === NO_COLLECTION ? null : targetId
        );
      }
    },
  });

  // React refuses to render a javascript: URL passed as a prop ("React has blocked
  // a javascript: URL as a security precaution"), so the href is attached to the
  // DOM node directly. Keep this effect: the bookmarklet stops working without it.
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    bookmarkletRef.current?.setAttribute('href', BOOKMARKLET_CODE);
  }, []);

  const handleFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim(), activeParentFolderId);
    setNewFolderName('');
    setIsCreatingFolder(false);
    setActiveParentFolderId(null);
  };

  const handleRenameSubmit = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editFolderName.trim()) return;
    await onRenameFolder(id, editFolderName.trim());
    setEditingFolderId(null);
  };

  // Tags stay monochrome: color in this app is reserved for status and actions
  const TAG_PILL_CLASS =
    'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900';
  const TAG_PILL_SELECTED_CLASS =
    'bg-zinc-900 border-zinc-900 text-white shadow-2xs';

  // Group top-level folders vs nested child folders
  const orderFolders = <T extends { name: string; count?: number }>(
    items: T[]
  ): T[] =>
    [...items].sort((a, b) =>
      sortFoldersByCount
        ? (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)
    );
  const rootFolders = orderFolders(folders.filter((f) => !f.parent_id));
  const getSubFolders = (parentId: string) =>
    orderFolders(folders.filter((f) => f.parent_id === parentId));
  const orderedTags = [...tags].sort((a, b) =>
    sortTagsByCount
      ? (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name)
  );

  // Removing is only meaningful while looking inside a collection; elsewhere a
  // drag can only file the bookmark or move it between collections.
  const openCollection = selectedFolderId
    ? folders.find((f) => f.id === selectedFolderId)
    : null;

  return (
    <>
      {/* Mobile scrim. Tapping it closes the drawer; it is inert on desktop. */}
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onCloseMobile}
        className={`lg:hidden fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-2xs transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`bg-[#F8F9FA] p-5 flex flex-col justify-between select-none h-full min-h-0 overflow-hidden overflow-x-hidden
          fixed inset-y-0 left-0 z-50 w-[17rem] max-w-[85vw] transition-transform duration-250 ease-out
          lg:static lg:z-auto lg:w-64 lg:min-w-[16rem] lg:max-w-[16rem] lg:transition-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden overflow-x-hidden pr-1 space-y-6 lg:overflow-y-auto lg:custom-scrollbar">
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-2 px-2 pt-1 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs border border-zinc-200/90 bg-zinc-950 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.svg"
                  alt="Snapshort Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-zinc-900 block leading-tight">
                  Snapshort
                </span>
                <span className="text-[10px] pointer-coarse:text-[11px] text-zinc-400 font-medium">
                  Visual Bookmarks
                </span>
              </div>
            </div>
          </div>

          {/* 1. Main Navigation: All Bookmarks, Favorites, Recent, Archive, Trash */}
          <nav className="space-y-1 shrink-0">
            <button
              onClick={() => {
                onSelectView('all');
                onSelectFolder(null);
                onSelectTag(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-[scale] duration-150 active:scale-[0.98] pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                activeView === 'all' && !selectedFolderId && !selectedTag
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4" />
                <span>All Bookmarks</span>
              </div>
              {Boolean(counts.all) && (
                <span
                  className={`text-[10px] pointer-coarse:text-[11px] font-mono ${activeView === 'all' && !selectedFolderId && !selectedTag ? 'text-zinc-300' : 'text-zinc-400'}`}
                >
                  {counts.all}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                onSelectView('favorites');
                onSelectFolder(null);
                onSelectTag(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-[scale] duration-150 active:scale-[0.98] pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                activeView === 'favorites'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4" />
                <span>Favorites</span>
              </div>
              {Boolean(counts.favorites) && (
                <span
                  className={`text-[10px] pointer-coarse:text-[11px] font-mono ${activeView === 'favorites' ? 'text-zinc-300' : 'text-zinc-400'}`}
                >
                  {counts.favorites}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                onSelectView('recent');
                onSelectFolder(null);
                onSelectTag(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-[scale] duration-150 active:scale-[0.98] pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                activeView === 'recent'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4" />
                <span>Recent</span>
              </div>
              {Boolean(counts.recent) && (
                <span
                  className={`text-[10px] pointer-coarse:text-[11px] font-mono ${activeView === 'recent' ? 'text-zinc-300' : 'text-zinc-400'}`}
                >
                  {counts.recent}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                onSelectView('archive');
                onSelectFolder(null);
                onSelectTag(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-[scale] duration-150 active:scale-[0.98] pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                activeView === 'archive'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Archive className="w-4 h-4" />
                <span>Archive</span>
              </div>
              {Boolean(counts.archive) && (
                <span
                  className={`text-[10px] pointer-coarse:text-[11px] font-mono ${activeView === 'archive' ? 'text-zinc-300' : 'text-zinc-400'}`}
                >
                  {counts.archive}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                onSelectView('trash');
                onSelectFolder(null);
                onSelectTag(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-[scale] duration-150 active:scale-[0.98] pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                activeView === 'trash'
                  ? 'bg-red-950 text-red-200 shadow-xs'
                  : 'text-zinc-600 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4" />
                <span>Trash</span>
              </div>
              {Boolean(counts.trash) && (
                <span
                  className={`text-[10px] pointer-coarse:text-[11px] font-mono ${activeView === 'trash' ? 'text-red-300' : 'text-red-500'}`}
                >
                  {counts.trash}
                </span>
              )}
            </button>
          </nav>

          {/* 2. Folders & Nested Collections with Rename & Delete */}
          <div className="space-y-2 flex flex-col min-h-0 flex-1 max-h-fit lg:flex-none lg:shrink-0">
            <div className="flex items-center justify-between px-2 text-[11px] pointer-coarse:text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Collections</span>
              {/* Tight cluster: 44px touch targets that overlap by a few pixels, so the
                  icons sit close together without shrinking the tap area. */}
              <div className="-mr-1.5 flex items-center gap-0 pointer-coarse:-mr-2.5">
                <button
                  onClick={() => setSortFoldersByCount((on) => !on)}
                  className={`p-1 rounded transition-colors cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:-mx-1.5 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                    sortFoldersByCount
                      ? 'text-zinc-900'
                      : 'text-zinc-400 hover:text-zinc-800'
                  }`}
                  title={
                    sortFoldersByCount
                      ? 'Sorted by most bookmarks — back to A to Z'
                      : 'Sort collections by most bookmarks'
                  }
                >
                  {sortFoldersByCount ? (
                    <ArrowDown10 className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsCreatingFolder(true);
                    setActiveParentFolderId(null);
                  }}
                  className="p-1 hover:text-zinc-800 transition-colors cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:-mx-1.5 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25"
                  title="New Top-Level Collection"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isCreatingFolder && (
              <form
                onSubmit={handleFolderSubmit}
                className="px-1 py-1 flex items-center gap-1"
              >
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={
                    activeParentFolderId
                      ? 'Subfolder name...'
                      : 'Collection name...'
                  }
                  className={`flex-1 px-3 py-1.5 pointer-coarse:min-h-11 text-xs font-medium ${FIELD_CLASS}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                    setActiveParentFolderId(null);
                  }}
                  className="p-1 pointer-coarse:p-3 text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </form>
            )}

            <FlipList
              className="space-y-0.5 px-1 flex-1 min-h-0 overflow-y-auto no-scrollbar lg:flex-none lg:max-h-40"
              orderKey={`${sortFoldersByCount}-${rootFolders.map((f) => f.id).join(',')}`}
            >
              {rootFolders.length === 0 && !isCreatingFolder && (
                <p className="text-xs text-zinc-400 italic px-2.5">
                  No collections yet
                </p>
              )}

              {rootFolders.map((folder) => {
                const subFolders = getSubFolders(folder.id);
                const isSelected = selectedFolderId === folder.id;
                // Accordion: a collection's list is open while that collection - or one of
                // its subcollections - is selected, so picking another closes the previous.
                // While a card is being dragged every list opens, otherwise a bookmark in
                // the current grid could never reach a subcollection of another one.
                const isExpanded =
                  subFolders.length > 0 &&
                  (Boolean(draggingBookmarkId) ||
                    isSelected ||
                    subFolders.some((sub) => sub.id === selectedFolderId));
                const isEditing = editingFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    data-flip-key={folder.id}
                    className="space-y-0.5 group/folder"
                  >
                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleRenameSubmit(folder.id, e)}
                        className="flex items-center gap-1 px-2 py-1"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editFolderName}
                          onChange={(e) => setEditFolderName(e.target.value)}
                          className={`flex-1 px-3 py-1.5 pointer-coarse:min-h-11 text-xs font-medium ${FIELD_CLASS}`}
                        />
                        <button
                          type="submit"
                          className="p-1 pointer-coarse:p-2 hover:text-emerald-700"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFolderId(null)}
                          className="p-1 pointer-coarse:p-2 hover:text-zinc-700"
                        >
                          <X className="w-3 h-3 text-zinc-400" />
                        </button>
                      </form>
                    ) : (
                      <div
                        {...dragOverProps(folder.id)}
                        onClick={(e) => {
                          const row = e.currentTarget;
                          onSelectView('all');
                          onSelectFolder(isSelected ? null : folder.id);
                          // On touch the list opens below the fold, so bring it
                          // into view; otherwise the subcollections stay unseen.
                          if (
                            !isSelected &&
                            subFolders.length > 0 &&
                            coarsePointer
                          ) {
                            // Wait out the height transition, otherwise the list
                            // still measures 0px tall and nothing scrolls.
                            window.setTimeout(() => {
                              const list =
                                row.nextElementSibling as HTMLElement | null;
                              list?.scrollIntoView({
                                block: 'nearest',
                                behavior: 'smooth',
                              });
                            }, 260);
                          }
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 relative rounded-lg text-xs font-medium cursor-pointer pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                          isSelected
                            ? 'bg-zinc-900 text-white font-semibold'
                            : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
                        }`}
                      >
                        {/* Drop highlight lives on its own layer: fading the row
                            background would also fade the selection pill. */}
                        <span
                          aria-hidden
                          className={`pointer-events-none absolute inset-0 rounded-lg bg-emerald-50 ring-1 ring-emerald-300 transition-opacity duration-150 ease-out ${
                            dropTargetId === folder.id
                              ? 'opacity-100'
                              : 'opacity-0'
                          }`}
                        />
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="w-3.5 h-3.5 opacity-70 shrink-0" />
                          <span className="truncate">{folder.name}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {Boolean(folder.count) && (
                            <span className="text-[10px] pointer-coarse:text-[11px] font-mono opacity-70 group-hover/folder:hidden pointer-coarse:hidden">
                              {folder.count}
                            </span>
                          )}
                          {/* Folder Action triggers on hover */}
                          {/* Overlapping 44px targets: the icons read as one tight group
                              while each button keeps a full tap area. */}
                          <div className="-mr-1.5 hidden group-hover/folder:flex pointer-coarse:flex items-center gap-1 pointer-coarse:-mr-2.5 pointer-coarse:gap-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsCreatingFolder(true);
                                setActiveParentFolderId(folder.id);
                              }}
                              className="p-0.5 pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:-mx-2 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center hover:text-emerald-600"
                              title="Add subfolder"
                            >
                              <FolderPlus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFolderId(folder.id);
                                setEditFolderName(folder.name);
                              }}
                              className="p-0.5 pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:-mx-2 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center hover:text-zinc-800"
                              title="Rename"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestDeleteFolder(folder.id, folder.name);
                              }}
                              className="p-0.5 pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:-mx-2 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center hover:text-red-600"
                              title="Delete"
                            >
                              <Trash className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Nested Sub-folders: kept mounted so the open/close can animate */}
                    {subFolders.length > 0 && (
                      <div
                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <FlipList
                            className="pl-4 space-y-0.5 border-l border-zinc-200 ml-3"
                            orderKey={`${sortFoldersByCount}-${subFolders.map((f) => f.id).join(',')}`}
                          >
                            {subFolders.map((sub) => (
                              <div
                                key={sub.id}
                                data-flip-key={sub.id}
                                {...dragOverProps(sub.id)}
                                onClick={() => {
                                  onSelectView('all');
                                  onSelectFolder(
                                    selectedFolderId === sub.id ? null : sub.id
                                  );
                                }}
                                className={`flex items-center justify-between px-2.5 py-1 relative rounded-md text-[11px] font-medium cursor-pointer pointer-coarse:min-h-11 pointer-coarse:text-xs group/sub focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                                  selectedFolderId === sub.id
                                    ? 'bg-zinc-900 text-white font-semibold'
                                    : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900'
                                }`}
                              >
                                <span
                                  aria-hidden
                                  className={`pointer-events-none absolute inset-0 rounded-md bg-emerald-50 ring-1 ring-emerald-300 transition-opacity duration-150 ease-out ${
                                    dropTargetId === sub.id
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  }`}
                                />
                                <div className="flex items-center gap-2 truncate">
                                  <CornerDownRight className="w-3 h-3 opacity-60 shrink-0" />
                                  <span className="truncate">{sub.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {Boolean(sub.count) && (
                                    <span className="font-mono text-[9px] opacity-70 group-hover/sub:hidden pointer-coarse:hidden">
                                      {sub.count}
                                    </span>
                                  )}
                                  <div className="-mr-1 hidden group-hover/sub:flex pointer-coarse:flex items-center gap-1 pointer-coarse:-mr-2 pointer-coarse:gap-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRequestDeleteFolder(sub.id, sub.name);
                                      }}
                                      className="p-0.5 pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:-mx-2 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center hover:text-red-600"
                                    >
                                      <Trash className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </FlipList>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </FlipList>
          </div>

          {/* 3. Colorful Tags Cloud (Interactive Pill Badges) */}
          <div className="space-y-2 flex flex-col min-h-0 flex-1 max-h-fit lg:flex-none lg:shrink-0">
            <div className="flex items-center justify-between px-2 text-[11px] pointer-coarse:text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <TagIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Tags Cloud</span>
              </div>
              <button
                onClick={() => setSortTagsByCount((on) => !on)}
                className={`p-1 rounded transition-colors cursor-pointer pointer-coarse:min-w-11 pointer-coarse:min-h-11 pointer-coarse:-mx-2 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                  sortTagsByCount
                    ? 'text-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-800'
                }`}
                title={
                  sortTagsByCount
                    ? 'Sorted by most used — back to A to Z'
                    : 'Sort tags by most used'
                }
              >
                {sortTagsByCount ? (
                  <ArrowDown10 className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <FlipList
              className="flex flex-wrap gap-1.5 px-1 flex-1 min-h-0 overflow-y-auto no-scrollbar lg:flex-none lg:max-h-40"
              orderKey={`${sortTagsByCount}-${orderedTags.map((t) => t.id).join(',')}`}
            >
              {tags.length === 0 ? (
                <p className="text-xs text-zinc-400 italic px-2.5">No tags yet</p>
              ) : (
                orderedTags.map((t) => {
                  const isSelected = selectedTag === t.name;
                  return (
                    <button
                      key={t.id}
                      data-flip-key={t.id}
                      onClick={() => {
                        onSelectView('all');
                        onSelectTag(isSelected ? null : t.name);
                      }}
                      className={`px-2.5 py-1 pointer-coarse:min-h-11 pointer-coarse:px-3 rounded-full text-[11px] pointer-coarse:text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 ${
                        isSelected ? TAG_PILL_SELECTED_CLASS : TAG_PILL_CLASS
                      }`}
                    >
                      #{t.name}
                      {t.count ? (
                        <span
                          className={`ml-1 text-[10px] pointer-coarse:text-[11px] ${
                            isSelected ? 'text-zinc-300' : 'text-zinc-400'
                          }`}
                        >
                          ({t.count})
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </FlipList>
          </div>
        </div>

        {/* Bookmarklet */}
        <div className="hidden lg:block pt-4 border-t border-zinc-200/80 space-y-2 shrink-0">
          <a
            ref={bookmarkletRef}
            href="#"
            draggable
            className="w-full py-2 pointer-coarse:min-h-11 px-3 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-zinc-700 transition-all cursor-grab active:cursor-grabbing shadow-2xs group"
            title="Drag me to your bookmarks bar"
          >
            <GripVertical className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
            <Bookmark className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition duration-150 -ml-0.5" />
            <span>Snapshort</span>
          </a>
          <p className="text-[10px] text-zinc-400 text-center leading-tight pt-0.5">
            Drag to your bookmarks bar, then click it on any page to save it
            here.
          </p>
        </div>
      </aside>

      {/* Drop target to pull a bookmark out of the collection currently open.
        Floating so it never reflows the collection list mid-drag, and centered
        so it cannot collide with the toast in the bottom-right corner. */}
      {draggingBookmarkId && openCollection && (
        <div
          {...dragOverProps(NO_COLLECTION)}
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed text-xs font-semibold shadow-lg transition-all duration-150 ${
            dropTargetId === NO_COLLECTION
              ? 'border-red-500 bg-red-100 text-red-700'
              : 'border-red-400 bg-red-50 text-red-700'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove from {openCollection.name}</span>
        </div>
      )}
    </>
  );
}
