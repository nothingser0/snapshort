import React from 'react';
import { 
  Compass, 
  Clock, 
  Layers, 
  Folder, 
  Tag as TagIcon,
  Sparkles,
  Bookmark
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  tags: Array<{ id: string; name: string }>;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  totalCount: number;
  readyCount: number;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  tags,
  selectedTag,
  onSelectTag,
  totalCount,
  readyCount,
}: SidebarProps) {
  // Bookmarklet code that lets user drag to browser bookmark bar and save active tab to Snapshort
  const bookmarkletCode = `javascript:(function(){const u=encodeURIComponent(window.location.href);const t=encodeURIComponent(document.title);window.open('http://localhost:3000/?quick_url='+u+'&quick_title='+t,'_blank','width=600,height=500');})();`;

  return (
    <aside className="w-64 bg-white rounded-[32px] p-6 border border-zinc-200/70 shadow-xs flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Logo Header */}
        <div className="flex items-center gap-2.5 mb-8 px-1">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="font-black text-sm tracking-widest text-zinc-900 block leading-tight">SNAPSHORT</span>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Visual Vault</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5">
          <button
            onClick={() => {
              onSelectTab('all');
              onSelectTag(null);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all' && !selectedTag
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Compass className="w-4 h-4" />
              <span>Explore All</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              activeTab === 'all' && !selectedTag ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => {
              onSelectTab('dashboard');
              onSelectTag(null);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4" />
              <span>Overview</span>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('recent')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'recent'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4" />
              <span>Recent</span>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('ready')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ready'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Folder className="w-4 h-4" />
              <span>Captured Previews</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full">
              {readyCount}
            </span>
          </button>
        </nav>

        {/* Divider */}
        <div className="my-5 border-t border-dashed border-zinc-200" />

        {/* Tags Section */}
        <div className="px-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
            <span>Tags</span>
            <TagIcon className="w-3.5 h-3.5 text-zinc-400" />
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {tags.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">No tags yet</p>
            ) : (
              tags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTag(selectedTag === t.name ? null : t.name)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    selectedTag === t.name
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                  }`}
                >
                  <span className="truncate max-w-[130px]">#{t.name}</span>
                  {selectedTag === t.name && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Pro Feature: 1-Click Bookmarklet Tool */}
      <div className="pt-4 border-t border-zinc-100 space-y-3">
        <a
          href={bookmarkletCode}
          onClick={(e) => {
            e.preventDefault();
            alert('Tarik (drag) tombol ini ke Bookmarks Bar browser Anda untuk menyimpan web page dari tab mana pun hanya dengan 1 klik!');
          }}
          className="w-full py-2 px-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-bold text-zinc-700 transition-all cursor-grab active:cursor-grabbing shadow-2xs group"
          title="Drag and drop to your browser bookmark bar"
        >
          <Bookmark className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
          <span>+ Drag Bookmarklet</span>
        </a>

        <div className="text-[11px] text-zinc-400 flex items-center justify-between px-1">
          <span>SQLite WAL</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Engine Online
          </span>
        </div>
      </div>
    </aside>
  );
}
