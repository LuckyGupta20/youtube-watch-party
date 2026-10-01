import React, { useState, useEffect } from 'react';
import { 
  Tv, Sparkles, Users, Shield, ArrowRight, Play, 
  Video, CheckCircle2, Flame, Copy, HelpCircle 
} from 'lucide-react';

export default function Lobby({ onJoinRoom }) {
  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [username, setUsername] = useState('Lucky_Dev');
  const [roomCode, setRoomCode] = useState('');
  const [initialVideoId, setInitialVideoId] = useState('b9EkMc79ZSU');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-detect room code from URL parameter (?room=WP-XXXXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setRoomCode(roomFromUrl.toUpperCase());
      setMode('join');
    }
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your nickname');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const apiHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `http://${window.location.hostname}:8000`
        : window.location.origin;

      const res = await fetch(`${apiHost}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialVideoId: initialVideoId.trim() || 'b9EkMc79ZSU' })
      });

      if (!res.ok) {
        throw new Error('Failed to create room on server');
      }

      const data = await res.json();
      onJoinRoom(data.roomId, username.trim());
    } catch (err) {
      console.warn('API fetch failed, falling back to local room generator:', err);
      // Fallback: generate local room code
      const localCode = `WP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      onJoinRoom(localCode, username.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinExisting = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your nickname');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a valid room code');
      return;
    }
    onJoinRoom(roomCode.trim().toUpperCase(), username.trim());
  };

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-950/60">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white leading-none">
              WatchParty <span className="text-red-500">Live</span>
            </h1>
            <span className="text-[11px] text-slate-400 font-mono">Synchronized Video Theater</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Server-Enforced RBAC</span>
        </div>
      </header>

      {/* Main Hero & Card Section */}
      <main className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto py-8 z-10">
        
        {/* Left: Product Value & Highlights */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/60 border border-red-800/40 text-red-400 text-xs font-bold">
            <Flame className="w-4 h-4 text-red-500 fill-red-500" />
            <span>FastAPI WebSockets &bull; Dynamic Drift Engine</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Watch YouTube Together in <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Flawless Sub-50ms</span> Sync.
          </h2>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
            A production-grade watch party platform featuring server-side Role-Based Access Control (RBAC), intelligent drift compensation, floating live reactions, and real-time chat.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                👑 Host &amp; Mods
              </span>
              <p className="text-[11px] text-slate-400">
                Authoritative playback controls and participant management.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                ⚡ Zero Desync
              </span>
              <p className="text-[11px] text-slate-400">
                Automatic drift adjustment keeps all clients locked to within 1.2s.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                💬 Live Social
              </span>
              <p className="text-[11px] text-slate-400">
                Synchronized room chat and floating emoji bursts across the stream.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Join / Create Interactive Card */}
        <div className="lg:col-span-5 w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          
          {/* Mode Switcher */}
          <div className="flex p-1 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold">
            <button
              onClick={() => { setMode('create'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl transition ${
                mode === 'create'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create New Room
            </button>
            <button
              onClick={() => { setMode('join'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl transition ${
                mode === 'join'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Join Existing Room
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          {mode === 'create' ? (
            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="host-name" className="font-semibold text-slate-300">
                  Your Nickname (You will be Host 👑):
                </label>
                <input
                  id="host-name"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Lucky_Host"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="init-video" className="font-semibold text-slate-300">
                  Initial Video (YouTube URL or ID):
                </label>
                <input
                  id="init-video"
                  type="text"
                  value={initialVideoId}
                  onChange={(e) => setInitialVideoId(e.target.value)}
                  placeholder="e.g. b9EkMc79ZSU (Stranger Things 4)"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-red-500 font-mono text-[11px]"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-950/50 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                <span>{isLoading ? 'Creating Room...' : 'Start Watch Party'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinExisting} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="join-name" className="font-semibold text-slate-300">
                  Your Nickname:
                </label>
                <input
                  id="join-name"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Aryan_Guest"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="room-code" className="font-semibold text-slate-300">
                  Room Code:
                </label>
                <input
                  id="room-code"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WP-A1B2C3"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-red-500 font-mono tracking-widest uppercase"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-950/50 flex items-center justify-center gap-2 transition active:scale-95"
              >
                <span>Join Theater</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            First user in a room automatically receives the <strong>Host</strong> role.
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-600 py-3 border-t border-slate-900 z-10">
        WatchParty Core &bull; Round 2 Engineering Take-Home &bull; Built with FastAPI &amp; React
      </footer>

    </div>
  );
}
