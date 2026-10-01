import React, { useState } from 'react';
import { X, Tv, Film, Music, Sparkles, Check } from 'lucide-react';

const PRESET_VIDEOS = [
  {
    id: 'b9EkMc79ZSU',
    title: 'Stranger Things 4 - Official Vol 2 Trailer',
    category: 'Trailers',
    thumbnail: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'LXb3EKWsInQ',
    title: 'Costa Rica in 4K 60fps Ultra HD',
    category: 'Nature & 4K',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up - Rick Astley',
    category: 'Classics & Music',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'aqz-KE-bpKQ',
    title: 'Big Buck Bunny (Official 4K 60FPS)',
    category: 'Animation',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80'
  }
];

export default function ChangeVideoModal({ isOpen, onClose, onChangeVideo }) {
  const [videoInput, setVideoInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Extract 11-char YouTube ID from standard URLs or raw strings
  const extractVideoId = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Direct 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // Standard youtube.com/watch?v=...
    const urlMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }

    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = extractVideoId(videoInput);
    if (!id) {
      setError('Invalid YouTube link or video ID. Please paste a valid YouTube URL.');
      return;
    }
    onChangeVideo(id);
    onClose();
  };

  const handleSelectPreset = (id) => {
    onChangeVideo(id);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Change Theater Video</h3>
              <p className="text-xs text-slate-400">Synchronizes new video across all participants</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Custom URL Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <label htmlFor="yt-url" className="block text-xs font-semibold text-slate-300">
              Paste YouTube Video URL or Video ID:
            </label>
            <div className="flex gap-2">
              <input
                id="yt-url"
                type="text"
                value={videoInput}
                onChange={(e) => {
                  setVideoInput(e.target.value);
                  setError('');
                }}
                placeholder="e.g. https://www.youtube.com/watch?v=..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-950/40"
              >
                Sync Video
              </button>
            </div>
            {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
          </form>

          {/* Quick Preset Library */}
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Or pick a popular watch party stream:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_VIDEOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPreset(item.id)}
                  className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-600 text-left transition group flex items-center gap-3"
                >
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-12 h-12 rounded-lg object-cover group-hover:scale-105 transition"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-amber-400/90 block">
                      {item.category}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 block truncate group-hover:text-white">
                      {item.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
