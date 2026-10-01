import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Users, MessageSquare, Crown, Shield, User, 
  UserMinus, UserCheck, Flame, Heart, Smile, Sparkles, AlertTriangle 
} from 'lucide-react';

const REACTION_EMOJIS = ['🔥', '🎉', '❤️', '😂', '👏', '🍿'];

export default function ChatPanel({
  chatMessages,
  participants,
  currentUser,
  isHost,
  onSendMessage,
  onSendReaction,
  onAssignRole,
  onRemoveParticipant
}) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'participants'
  const [inputText, setInputText] = useState('');
  const messagesContainerRef = useRef(null);

  // Auto-scroll chat internally to bottom on new message WITHOUT touching browser window scroll
  useEffect(() => {
    if (activeTab === 'chat' && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Host':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
            <Crown className="w-3 h-3 text-amber-400 fill-amber-400" /> Host
          </span>
        );
      case 'Moderator':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
            <Shield className="w-3 h-3 text-blue-400" /> Mod
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
            <User className="w-3 h-3" /> Viewer
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
      
      {/* Top Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/60 p-1.5 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
            activeTab === 'chat'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-red-500" />
          <span>Live Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('participants')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
            activeTab === 'participants'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>Participants ({participants.length})</span>
        </button>
      </div>

      {/* Tab 1: Live Chat */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Messages Scroll Area */}
          <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-600 animate-pulse" />
                <p className="text-xs">No chat messages yet.</p>
                <p className="text-[11px] text-slate-600">Send a greeting or reaction to start the watch party!</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="text-center py-1">
                      <span className="text-[10px] text-slate-500 bg-slate-950/80 px-2.5 py-1 rounded-full border border-slate-800">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                const isMe = currentUser && msg.userId === currentUser.userId;

                return (
                  <div key={msg.id} className={`flex flex-col space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold text-slate-300">
                        {msg.username} {isMe && '(You)'}
                      </span>
                      {getRoleBadge(msg.role)}
                      <span className="text-[10px] text-slate-600 font-mono">{msg.timestamp}</span>
                    </div>

                    <div 
                      className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words ${
                        isMe 
                          ? 'bg-red-600/90 text-white rounded-tr-xs' 
                          : 'bg-slate-800 text-slate-200 rounded-tl-xs border border-slate-700/60'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Reaction Emoji Bar */}
          <div className="px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-around">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                className="p-1 text-lg hover:scale-125 active:scale-95 transition-transform"
                title={`Send ${emoji} reaction`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/60 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message in room..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

      {/* Tab 2: Participants & RBAC Controls */}
      {activeTab === 'participants' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>Members in Room</span>
            <span>{participants.length} Active</span>
          </div>

          <div className="space-y-2">
            {participants.map((p) => {
              const isTargetMe = currentUser && p.userId === currentUser.userId;

              return (
                <div 
                  key={p.userId} 
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs">
                      {p.username ? p.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200 truncate">
                          {p.username}
                        </span>
                        {isTargetMe && <span className="text-[10px] text-slate-500">(You)</span>}
                      </div>
                      <div className="mt-0.5">{getRoleBadge(p.role)}</div>
                    </div>
                  </div>

                  {/* Host RBAC Management Actions */}
                  {isHost && !isTargetMe && (
                    <div className="flex items-center gap-1">
                      {p.role === 'Participant' && (
                        <button
                          onClick={() => onAssignRole(p.userId, 'Moderator')}
                          title="Promote to Moderator (grants playback controls)"
                          className="px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Shield className="w-3 h-3" /> Make Mod
                        </button>
                      )}

                      {p.role === 'Moderator' && (
                        <button
                          onClick={() => onAssignRole(p.userId, 'Participant')}
                          title="Demote to standard Viewer"
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700 text-[10px] font-medium transition"
                        >
                          Demote
                        </button>
                      )}

                      <button
                        onClick={() => onRemoveParticipant(p.userId)}
                        title="Remove participant from room"
                        className="p-1 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Host Privileges
              </span>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                As the Host, only you can appoint Moderators or remove participants. Moderators can play, pause, seek, and change videos.
              </p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
