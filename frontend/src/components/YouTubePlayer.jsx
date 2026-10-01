import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, 
  Maximize, Minimize, Shield, Crown, User, RefreshCw, 
  Sparkles, Lock, Unlock, AlertCircle, Volume
} from 'lucide-react';

export default function YouTubePlayer({
  syncState,
  canControlPlayback,
  userRole,
  onPlay,
  onPause,
  onSeek,
  onRequestSync,
  floatingReactions = []
}) {
  const playerContainerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const lastReportedTimeRef = useRef(0);
  const seekDebounceTimeoutRef = useRef(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [driftOffset, setDriftOffset] = useState('0.00');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showAutoplayNotice, setShowAutoplayNotice] = useState(false);
  const [participantNotice, setParticipantNotice] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Show temporary participant lock feedback when participant tries to manipulate video
  const triggerParticipantNotice = useCallback((message) => {
    setParticipantNotice(message);
    setTimeout(() => {
      setParticipantNotice((curr) => (curr === message ? null : curr));
    }, 3000);
  }, []);

  const handleNativeStateChangeRef = useRef(null);

  // 1. Initialize YouTube IFrame API Player
  useEffect(() => {
    let checkInterval = null;

    function initPlayer() {
      if (!window.YT || !window.YT.Player) return false;

      // Clean up previous instance if exists
      if (playerInstanceRef.current && playerInstanceRef.current.destroy) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          // ignore
        }
      }

      playerInstanceRef.current = new window.YT.Player('yt-player-container', {
        videoId: syncState.videoId,
        playerVars: {
          autoplay: 0,
          controls: 1, // Enable native YouTube controls for resolution, subtitles, volume
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            setIsPlayerReady(true);
            const dur = event.target.getDuration() || 0;
            setDuration(dur);
            if (event.target.isMuted && event.target.isMuted()) {
              setIsAudioMuted(true);
            }
          },
          onStateChange: (event) => {
            if (handleNativeStateChangeRef.current) {
              handleNativeStateChangeRef.current(event);
            }
          },
          onError: (event) => {
            console.warn('[YouTube Player] Error code:', event.data);
          }
        }
      });
      return true;
    }

    if (!initPlayer()) {
      checkInterval = setInterval(() => {
        if (initPlayer()) {
          clearInterval(checkInterval);
        }
      }, 150);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (playerInstanceRef.current && playerInstanceRef.current.destroy) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []); // Run once on mount

  // 2. Intercept Native YouTube State Changes (Always fresh via Ref!)
  handleNativeStateChangeRef.current = (event) => {
    const player = playerInstanceRef.current;
    if (!player) return;

    const state = event.data;

    // Check mute state
    try {
      if (player.isMuted) {
        setIsAudioMuted(player.isMuted());
      }
    } catch (e) {}

    // If change was initiated by incoming WebSocket sync, DO NOT re-broadcast to avoid loops!
    if (isRemoteUpdateRef.current) {
      return;
    }

    // Host or Moderator initiated change
    if (canControlPlayback) {
      if (state === window.YT.PlayerState.PLAYING) {
        // Also sync time if it drifted before playing
        const t = player.getCurrentTime ? player.getCurrentTime() || 0 : 0;
        if (Math.abs(t - (syncState.currentTime || 0)) > 1.0) {
          onSeek(t);
        }
        onPlay();
      } else if (state === window.YT.PlayerState.PAUSED) {
        const t = player.getCurrentTime ? player.getCurrentTime() || 0 : 0;
        onSeek(t);
        onPause();
      }
    } else {
      // PARTICIPANT tried to change playback directly in YouTube player!
      // Enforce server-side authority: revert local player back to room state
      if (state === window.YT.PlayerState.PLAYING && syncState.playState === 'PAUSED') {
        isRemoteUpdateRef.current = true;
        player.pauseVideo();
        triggerParticipantNotice('🔒 Playback is paused by Host');
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 500);
      } else if (state === window.YT.PlayerState.PAUSED && syncState.playState === 'PLAYING') {
        isRemoteUpdateRef.current = true;
        player.playVideo();
        triggerParticipantNotice('🔒 Playback is synchronized to Host');
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 500);
      }
    }
  };

  // 3. Synchronize Video ID
  useEffect(() => {
    if (!isPlayerReady || !playerInstanceRef.current) return;
    const player = playerInstanceRef.current;

    try {
      const currentUrl = player.getVideoUrl ? player.getVideoUrl() : '';
      if (!currentUrl.includes(syncState.videoId)) {
        isRemoteUpdateRef.current = true;
        player.loadVideoById({
          videoId: syncState.videoId,
          startSeconds: syncState.currentTime || 0
        });
        if (syncState.playState === 'PAUSED') {
          player.pauseVideo();
        }
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
      }
    } catch (err) {
      console.warn('Error synchronizing video ID:', err);
    }
  }, [syncState.videoId, isPlayerReady]);

  // 4. Synchronize Playback State & Dynamic Drift
  useEffect(() => {
    if (!isPlayerReady || !playerInstanceRef.current) return;
    const player = playerInstanceRef.current;

    try {
      const localTime = player.getCurrentTime ? player.getCurrentTime() || 0 : 0;
      const serverTargetTime = syncState.currentTime || 0;
      const drift = Math.abs(localTime - serverTargetTime);
      setDriftOffset(drift.toFixed(2));

      // SMART DRIFT COMPENSATION:
      // If drift exceeds threshold (> 1.2s), snap local playback to server time
      if (drift > 1.2) {
        isRemoteUpdateRef.current = true;
        player.seekTo(serverTargetTime, true);
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 500);
      }

      // Sync play/pause
      const currentState = player.getPlayerState ? player.getPlayerState() : null;
      if (syncState.playState === 'PLAYING') {
        if (currentState !== window.YT.PlayerState.PLAYING && currentState !== window.YT.PlayerState.BUFFERING) {
          isRemoteUpdateRef.current = true;
          const playPromise = player.playVideo();
          if (playPromise && playPromise.catch) {
            playPromise.catch(() => {
              // Browser blocked autoplay due to audio policy
              setShowAutoplayNotice(true);
            });
          }
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 600);
        }
      } else if (syncState.playState === 'PAUSED') {
        if (currentState !== window.YT.PlayerState.PAUSED) {
          isRemoteUpdateRef.current = true;
          player.pauseVideo();
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 600);
        }
      }
    } catch (err) {
      console.warn('Error during state sync:', err);
    }
  }, [syncState.playState, syncState.currentTime, isPlayerReady]);

  // 5. Periodic Local Progress Tracker (every 300ms)
  useEffect(() => {
    if (!isPlayerReady || !playerInstanceRef.current) return;
    const player = playerInstanceRef.current;

    const interval = setInterval(() => {
      try {
        if (player.getCurrentTime) {
          const t = player.getCurrentTime() || 0;
          setCurrentTime(t);

          // Calculate live drift
          if (syncState.currentTime) {
            const d = Math.abs(t - syncState.currentTime);
            setDriftOffset(d.toFixed(2));
          }
        }
        if (player.getDuration) {
          const d = player.getDuration();
          if (d && d !== duration) setDuration(d);
        }
      } catch (e) {}
    }, 300);

    return () => clearInterval(interval);
  }, [isPlayerReady, duration, syncState.currentTime]);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Controller Handlers
  const handleTogglePlay = () => {
    if (!canControlPlayback) {
      triggerParticipantNotice('🔒 Only Host or Moderator can alter playback');
      return;
    }
    if (syncState.playState === 'PLAYING') {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleSeek = (newTime) => {
    if (!canControlPlayback) {
      triggerParticipantNotice('🔒 Only Host or Moderator can seek timeline');
      return;
    }
    setCurrentTime(newTime);
    onSeek(newTime);
  };

  const handleSkip = (seconds) => {
    if (!canControlPlayback) {
      triggerParticipantNotice('🔒 Only Host or Moderator can skip');
      return;
    }
    const nextTime = Math.max(0, Math.min(duration, currentTime + seconds));
    handleSeek(nextTime);
  };

  const handleManualResync = () => {
    if (playerInstanceRef.current) {
      isRemoteUpdateRef.current = true;
      playerInstanceRef.current.seekTo(syncState.currentTime || 0, true);
      if (syncState.playState === 'PLAYING') {
        playerInstanceRef.current.playVideo();
      } else {
        playerInstanceRef.current.pauseVideo();
      }
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 600);
    }
    if (onRequestSync) onRequestSync();
  };

  const handleUnmuteAudio = () => {
    if (playerInstanceRef.current) {
      playerInstanceRef.current.unMute();
      playerInstanceRef.current.setVolume(100);
      setIsAudioMuted(false);
      setShowAutoplayNotice(false);
      if (syncState.playState === 'PLAYING') {
        playerInstanceRef.current.playVideo();
      }
    }
  };

  const handleToggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((e) => console.warn(e));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((e) => console.warn(e));
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={playerContainerRef} 
      className="flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl transition-all"
    >
      {/* 1. TOP STATUS BAR (Drift, Role Badge, Resync) */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
        
        {/* Left: Role & Room Sync Badge */}
        <div className="flex items-center gap-2">
          {/* Live Sync Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-semibold text-[11px] shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Sync</span>
            <span className="text-emerald-400 font-mono text-[10px]">({driftOffset}s drift)</span>
          </div>

          {/* User Role Tag */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            userRole === 'Host' 
              ? 'bg-amber-950/70 border-amber-600/60 text-amber-300' 
              : userRole === 'Moderator'
              ? 'bg-blue-950/70 border-blue-600/60 text-blue-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-300'
          }`}>
            {userRole === 'Host' && <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />}
            {userRole === 'Moderator' && <Shield className="w-3 h-3 text-blue-400" />}
            {userRole === 'Participant' && <User className="w-3 h-3 text-slate-400" />}
            <span>{userRole} Mode</span>
          </div>
        </div>

        {/* Right: Quick Resync & Autoplay Audio Status */}
        <div className="flex items-center gap-2">
          {isAudioMuted && (
            <button
              onClick={handleUnmuteAudio}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold shadow-md transition active:scale-95 animate-pulse"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Click to Unmute</span>
            </button>
          )}

          <button
            onClick={handleManualResync}
            title="Force immediate time resynchronization with room"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium border border-slate-700/60 transition"
          >
            <RefreshCw className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Force Resync</span>
          </button>
        </div>
      </div>

      {/* 2. VIDEO CANVAS WITH FLOATING REACTION PARTICLES */}
      <div className="relative w-full aspect-video bg-black">
        
        {/* Actual YouTube IFrame Container */}
        <div id="yt-player-container" className="w-full h-full"></div>

        {/* Browser Autoplay Block Overlay Banner */}
        {showAutoplayNotice && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/90 text-white flex items-center justify-center mb-4 shadow-xl">
              <Play className="w-8 h-8 fill-white pl-1" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Click to Start Watching</h3>
            <p className="text-xs text-slate-300 max-w-sm mb-4">
              Your browser paused playback to comply with audio autoplay policies. Click below to watch in sync.
            </p>
            <button
              onClick={handleUnmuteAudio}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-sm shadow-xl hover:brightness-110 active:scale-95 transition"
            >
              Start Watching with Audio
            </button>
          </div>
        )}

        {/* Participant Action Denied Pill */}
        {participantNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-slate-900/95 border border-amber-500/60 text-amber-200 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fadeIn">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{participantNotice}</span>
          </div>
        )}

        {/* Floating Emoji Reactions Layer */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          {floatingReactions.map((item) => (
            <div
              key={item.id}
              style={{ left: `${item.left}%` }}
              className="absolute bottom-6 flex flex-col items-center animate-float-up pointer-events-none"
            >
              <span className="text-4xl drop-shadow-xl select-none">{item.emoji}</span>
              <span className="text-[10px] font-bold text-white bg-black/70 px-2 py-0.5 rounded-full backdrop-blur-xs mt-1 border border-white/10 shadow-lg">
                {item.username}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. SYNCED STUDIO DOCK (Below Video) */}
      <div className="p-4 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-3">
        
        {/* Scrubber / Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-300 font-semibold min-w-[45px]">
            {formatTime(currentTime)}
          </span>

          <div className="relative flex-1 group">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              disabled={!canControlPlayback}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              aria-label="Seek video progress"
              className={`w-full h-1.5 rounded-full appearance-none transition-all ${
                canControlPlayback
                  ? 'cursor-pointer bg-slate-700 hover:h-2 accent-red-500'
                  : 'cursor-not-allowed bg-slate-800 opacity-60 accent-slate-500'
              }`}
            />
          </div>

          <span className="font-mono text-xs text-slate-400 min-w-[45px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Control Buttons Bar */}
        <div className="flex items-center justify-between">
          
          {/* Left Actions: Play/Pause, -10s, +10s */}
          <div className="flex items-center gap-2">
            
            {/* Play/Pause Button */}
            <button
              onClick={handleTogglePlay}
              disabled={!canControlPlayback}
              title={
                canControlPlayback
                  ? syncState.playState === 'PLAYING'
                    ? 'Pause Room'
                    : 'Play Room'
                  : 'Playback is managed by the Host/Moderator'
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md active:scale-95 ${
                canControlPlayback
                  ? syncState.playState === 'PLAYING'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              {canControlPlayback ? (
                syncState.playState === 'PLAYING' ? (
                  <>
                    <Pause className="w-4 h-4 fill-white" />
                    <span>Pause Room</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white pl-0.5" />
                    <span>Play Room</span>
                  </>
                )
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Host Controls Playback</span>
                </>
              )}
            </button>

            {/* Quick Skips */}
            {canControlPlayback && (
              <>
                <button
                  onClick={() => handleSkip(-10)}
                  title="Rewind 10 seconds"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-90"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSkip(10)}
                  title="Forward 10 seconds"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-90"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Right Actions: Fullscreen & Status */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-400 font-mono">
              State: <span className="font-bold text-white">{syncState.playState}</span>
            </span>

            <button
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
