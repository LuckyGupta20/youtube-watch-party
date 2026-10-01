import React, { useState } from 'react';
import { 
  Tv, Copy, Check, LogOut, Video, Wifi, WifiOff, 
  Crown, Shield, User, Sparkles, ExternalLink 
} from 'lucide-react';

export default function Navbar({
  roomId,
  currentUser,
  isConnected,
  canControlPlayback,
  onOpenChangeVideo,
  onLeaveRoom
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Host':
        return <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />;
      case 'Moderator':
        return <Shield className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <User className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-slate-950/80 border-b border-slate-800 backdrop-blur-md flex items-center justify-between z-40 sticky top-0">
      
      {/* Left: Brand & Room Code */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onLeaveRoom}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-950/50">
            <Tv className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <span className="font-extrabold text-sm tracking-tight text-white block leading-none">
              WatchParty <span className="text-red-500">Live</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wide">Sync Theater &bull; RBAC</span>
          </div>
        </div>

        {/* Room Invite Chip */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
          <span className="text-slate-400 font-mono">Room:</span>
          <span className="font-mono font-bold text-white tracking-wider">{roomId}</span>
          <button
            onClick={handleCopyInvite}
            title="Copy invite URL to share with friends"
            className="ml-1 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1 font-semibold text-[11px]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden md:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Invite Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right: Actions, Identity & Controls */}
      <div className="flex items-center gap-3">
        
        {/* Change Video Button (Host/Mod Only) */}
        {canControlPlayback && (
          <button
            onClick={onOpenChangeVideo}
            className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-red-950/40 active:scale-95"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Change Video</span>
          </button>
        )}

        {/* Connection Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden md:inline text-emerald-400 font-semibold">Live</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-rose-400">Offline</span>
            </>
          )}
        </div>

        {/* Current User Role Pill */}
        {currentUser && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="font-semibold text-slate-200 truncate max-w-[100px] sm:max-w-none">
              {currentUser.username}
            </span>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
              {getRoleIcon(currentUser.role)}
              <span>{currentUser.role}</span>
            </div>
          </div>
        )}

        {/* Exit Room */}
        <button
          onClick={onLeaveRoom}
          title="Leave Watch Party"
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>

      </div>

    </header>
  );
}
