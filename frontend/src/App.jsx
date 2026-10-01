import React, { useState, useEffect, useCallback } from 'react';
import Lobby from './components/Lobby';
import Navbar from './components/Navbar';
import YouTubePlayer from './components/YouTubePlayer';
import ChatPanel from './components/ChatPanel';
import ChangeVideoModal from './components/ChangeVideoModal';
import { useWatchPartySocket } from './hooks/useWatchPartySocket';
import { AlertCircle, CheckCircle, Video, Shield, Crown, Sparkles, RefreshCw, X } from 'lucide-react';

export default function App() {
  const [roomId, setRoomId] = useState(() => {
    // Check if URL has ?room=...
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || null;
  });
  const [username, setUsername] = useState('Lucky_Dev');
  const [isChangeVideoOpen, setIsChangeVideoOpen] = useState(false);
  const [kickedReason, setKickedReason] = useState(null);

  const handleKicked = useCallback((reason) => {
    setKickedReason(reason);
    setRoomId(null);
  }, []);

  const {
    isConnected,
    currentUser,
    participants,
    syncState,
    chatMessages,
    floatingReactions,
    errorMessage,
    isHost,
    isModerator,
    canControlPlayback,
    sendPlay,
    sendPause,
    sendSeek,
    sendChangeVideo,
    sendAssignRole,
    sendRemoveParticipant,
    sendChatMessage,
    sendReaction,
    requestSync,
    clearError
  } = useWatchPartySocket(roomId, username, handleKicked);

  // Keep URL query param in sync with current room
  useEffect(() => {
    const url = new URL(window.location);
    if (roomId) {
      url.searchParams.set('room', roomId);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url);
  }, [roomId]);

  const handleJoinRoom = (id, name) => {
    setUsername(name);
    setRoomId(id);
    setKickedReason(null);
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
  };

  // If no room is active, render the Lobby onboarding
  if (!roomId) {
    return (
      <>
        {kickedReason && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-rose-950 border border-rose-700 text-rose-200 text-xs font-semibold shadow-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{kickedReason}</span>
            <button onClick={() => setKickedReason(null)} className="p-1 hover:bg-rose-900 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <Lobby onJoinRoom={handleJoinRoom} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex flex-col overflow-x-hidden">
      
      {/* 1. TOP NAVBAR */}
      <Navbar
        roomId={roomId}
        currentUser={currentUser}
        isConnected={isConnected}
        canControlPlayback={canControlPlayback}
        onOpenChangeVideo={() => setIsChangeVideoOpen(true)}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* 2. ERROR / RBAC DENIAL TOAST */}
      {errorMessage && (
        <div 
          role="alert"
          className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-rose-950/95 border border-rose-600/80 text-rose-200 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fadeIn max-w-md"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold block text-white">Action Denied</span>
            <span className="text-[11px] text-rose-300">{errorMessage}</span>
          </div>
          <button 
            onClick={clearError}
            className="p-1 rounded-lg hover:bg-rose-900/60 text-rose-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MAIN THEATER CONTAINER */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-4rem)]">
        
        {/* Left Column: Video Theater Canvas & Stream Deck (col-span-8 / 9) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col space-y-4">
          
          {/* Synchronized YouTube Player */}
          <YouTubePlayer
            syncState={syncState}
            canControlPlayback={canControlPlayback}
            userRole={currentUser?.role || 'Participant'}
            onPlay={sendPlay}
            onPause={sendPause}
            onSeek={sendSeek}
            onRequestSync={requestSync}
            floatingReactions={floatingReactions}
          />

          {/* Video Metadata & Role Permission Banner */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-red-500 bg-red-950/60 px-2 py-0.5 rounded-md border border-red-900/40">
                  Video ID: {syncState.videoId}
                </span>
                <span className="text-xs text-slate-400">
                  &bull; {participants.length} viewers in sync
                </span>
              </div>
              
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                Synchronized YouTube Stream
              </h2>

              <p className="text-xs text-slate-400">
                {canControlPlayback ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    You have playback authority as <strong>{currentUser?.role}</strong>. Your play, pause, and seek actions sync in real time.
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    Viewer mode active. Playback is automatically synchronized with the Host.
                  </span>
                )}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              {canControlPlayback && (
                <button
                  onClick={() => setIsChangeVideoOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <Video className="w-3.5 h-3.5 text-red-400" />
                  <span>Change Video</span>
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Right Column: Chat, Reactions & Host Control Desk (col-span-4 / 3) */}
        <div className="lg:col-span-4 xl:col-span-3 h-[600px] lg:h-[calc(100vh-6rem)] sticky top-20">
          <ChatPanel
            chatMessages={chatMessages}
            participants={participants}
            currentUser={currentUser}
            isHost={isHost}
            onSendMessage={sendChatMessage}
            onSendReaction={sendReaction}
            onAssignRole={sendAssignRole}
            onRemoveParticipant={sendRemoveParticipant}
          />
        </div>

      </main>

      {/* 4. CHANGE VIDEO MODAL */}
      <ChangeVideoModal
        isOpen={isChangeVideoOpen}
        onClose={() => setIsChangeVideoOpen(false)}
        onChangeVideo={sendChangeVideo}
      />

    </div>
  );
}
