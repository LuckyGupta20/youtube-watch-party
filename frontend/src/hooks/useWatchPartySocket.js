import { useState, useEffect, useRef, useCallback } from 'react';

export function useWatchPartySocket(roomId, username, onKicked) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // { userId, username, role }
  const [participants, setParticipants] = useState([]);
  const [syncState, setSyncState] = useState({
    playState: 'PAUSED',
    currentTime: 0,
    videoId: 'b9EkMc79ZSU'
  });
  const [chatMessages, setChatMessages] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pendingPacketsRef = useRef([]);
  const onKickedRef = useRef(onKicked);
  const usernameRef = useRef(username);
  const currentUserRef = useRef(null);
  const seenUserEventsRef = useRef(new Set());

  // Keep callback and username refs updated without causing re-connections
  useEffect(() => {
    onKickedRef.current = onKicked;
  }, [onKicked]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Clear toast error message after 4s
  const triggerError = useCallback((msg) => {
    setErrorMessage(msg);
    setTimeout(() => {
      setErrorMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  // Connect to WebSocket — ONLY re-runs if roomId changes!
  useEffect(() => {
    if (!roomId) return;

    let isUnmounted = false;
    let wsUrl = '';
    if (import.meta.env.VITE_WS_URL) {
      const baseUrl = import.meta.env.VITE_WS_URL.replace(/\/+$/, '');
      wsUrl = `${baseUrl}/ws/${roomId}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `${window.location.hostname}:8000` 
        : `${window.location.host}`;
      wsUrl = `${protocol}//${host}/ws/${roomId}`;
    }

    function connect() {
      if (isUnmounted) return;

      // Close any stale socket before creating a new one
      if (socketRef.current) {
        try {
          socketRef.current.onclose = null;
          socketRef.current.close();
        } catch (e) {}
      }

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        setIsConnected(true);

        // Send join_room event immediately upon connection
        const joinPacket = {
          event: 'join_room',
          payload: { username: usernameRef.current || 'Guest' }
        };
        ws.send(JSON.stringify(joinPacket));

        // Flush any queued packets that were dispatched while connecting
        while (pendingPacketsRef.current.length > 0) {
          const packet = pendingPacketsRef.current.shift();
          try {
            ws.send(JSON.stringify(packet));
          } catch (e) {
            console.warn('Failed to flush queued packet:', e);
          }
        }
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const packet = JSON.parse(event.data);
          const eventType = packet.event || packet.type;
          const payload = packet.payload || {};

          switch (eventType) {
            case 'sync_state':
              setSyncState({
                playState: payload.playState,
                currentTime: payload.currentTime,
                videoId: payload.videoId
              });
              break;

            case 'init_identity':
              setCurrentUser({
                userId: payload.userId,
                username: payload.username,
                role: payload.role
              });
              break;

            case 'user_joined':
              if (payload.participants) {
                setParticipants(payload.participants);
              }
              // Only add system message once per user session to prevent spam
              {
                const eventKey = `${payload.userId}-joined-${payload.role}`;
                if (!seenUserEventsRef.current.has(eventKey)) {
                  seenUserEventsRef.current.add(eventKey);
                  setChatMessages((prev) => [
                    ...prev,
                    {
                      id: `sys-${Date.now()}-${Math.random()}`,
                      isSystem: true,
                      text: `${payload.username} joined as ${payload.role}`
                    }
                  ]);
                }
              }
              break;

            case 'user_left':
              if (payload.participants) {
                setParticipants(payload.participants);
              }
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}-${Math.random()}`,
                  isSystem: true,
                  text: `${payload.username} left the room`
                }
              ]);
              break;

            case 'role_assigned':
              if (payload.participants) {
                setParticipants(payload.participants);
              }
              setCurrentUser((curr) => {
                if (curr && curr.userId === payload.userId) {
                  return { ...curr, role: payload.role };
                }
                return curr;
              });
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}-${Math.random()}`,
                  isSystem: true,
                  text: `${payload.username} was promoted to ${payload.role}`
                }
              ]);
              break;

            case 'participant_removed':
              if (payload.participants) {
                setParticipants(payload.participants);
              }
              if (currentUserRef.current && payload.userId === currentUserRef.current.userId) {
                if (onKickedRef.current) {
                  onKickedRef.current(payload.reason || 'You were removed by the host');
                }
              }
              break;

            case 'chat_message':
              if (payload.message && payload.message.startsWith('__REACTION__:')) {
                const emoji = payload.message.replace('__REACTION__:', '');
                setFloatingReactions((prev) => [
                  ...prev,
                  {
                    id: `react-${Date.now()}-${Math.random()}`,
                    emoji,
                    username: payload.username,
                    left: Math.floor(Math.random() * 60) + 20
                  }
                ]);
              } else {
                setChatMessages((prev) => [
                  ...prev,
                  {
                    id: `chat-${Date.now()}-${Math.random()}`,
                    userId: payload.userId,
                    username: payload.username,
                    role: payload.role,
                    message: payload.message,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ]);
              }
              break;

            case 'error':
              triggerError(payload.message || 'Action rejected by server');
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket packet:', err);
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        setIsConnected(false);
        // Clean reconnect with backoff
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection issue:', err);
        ws.close();
      };
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [roomId, triggerError]); // ONLY depends on roomId! Never re-connects on prop re-renders!

  // Outgoing dispatch helpers (with queuing if socket is connecting)
  const sendPacket = useCallback((event, payload = {}) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      pendingPacketsRef.current.push({ event, payload });
    } else {
      triggerError('Connecting to watch party server...');
    }
  }, [triggerError]);

  const sendPlay = useCallback(() => {
    sendPacket('play');
  }, [sendPacket]);

  const sendPause = useCallback(() => {
    sendPacket('pause');
  }, [sendPacket]);

  const sendSeek = useCallback((timeInSeconds) => {
    sendPacket('seek', { time: parseFloat(timeInSeconds) });
  }, [sendPacket]);

  const sendChangeVideo = useCallback((videoId) => {
    sendPacket('change_video', { videoId });
  }, [sendPacket]);

  const sendAssignRole = useCallback((targetUserId, newRole) => {
    sendPacket('assign_role', { userId: targetUserId, role: newRole });
  }, [sendPacket]);

  const sendRemoveParticipant = useCallback((targetUserId) => {
    sendPacket('remove_participant', { userId: targetUserId });
  }, [sendPacket]);

  const sendChatMessage = useCallback((message) => {
    if (!message || !message.trim()) return;
    sendPacket('chat_message', { message: message.trim() });
  }, [sendPacket]);

  const sendReaction = useCallback((emoji) => {
    sendPacket('chat_message', { message: `__REACTION__:${emoji}` });
  }, [sendPacket]);

  const requestSync = useCallback(() => {
    sendPacket('get_sync');
  }, [sendPacket]);

  // Role permissions checking helpers
  const isHost = currentUser?.role === 'Host';
  const isModerator = currentUser?.role === 'Moderator';
  const canControlPlayback = isHost || isModerator;

  return {
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
    clearError: () => setErrorMessage(null)
  };
}
