"""
Room Manager & Role-Based Access Control (RBAC) Engine
Watch Party Real-Time Backend
Author: Lucky Gupta
Enterprise: SafeSignal AI / WatchParty Core
"""

import time
import json
import logging
from enum import Enum
from typing import Dict, List, Optional
from fastapi import WebSocket

# Setup logger for production observability
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RoomManager")


class Role(str, Enum):
    """
    Role Definitions matching the specification exactly:
    - Host: Room creator (Full administrative and playback control)
    - Moderator: Elevated participant (Playback control & video changing)
    - Participant: Default joiner (Watch-only; cannot alter playback)
    """
    HOST = "Host"
    MODERATOR = "Moderator"
    PARTICIPANT = "Participant"


class PlayState(str, Enum):
    """
    Video Playback State Machine
    """
    PLAYING = "PLAYING"
    PAUSED = "PAUSED"


class Participant:
    """
    Represents an individual user connected to a Watch Party room.
    Encapsulates identity, assigned role, and the live WebSocket pipe.
    """
    def __init__(self, user_id: str, username: str, role: Role, websocket: WebSocket):
        self.user_id = user_id
        self.username = username
        self.role = role
        self.websocket = websocket
        self.joined_at = time.time()

    def to_dict(self) -> dict:
        """
        Serializes user metadata for broadcasting to clients.
        Notice: The live WebSocket connection is excluded because it's not JSON serializable.
        """
        return {
            "userId": self.user_id,
            "username": self.username,
            "role": self.role.value,
            "joinedAt": self.joined_at
        }


class Room:
    """
    Represents a synchronized Watch Party room.
    Maintains video state, time drift calculations, and participant access control.
    """
    def __init__(self, room_id: str, initial_video_id: str = "b9EkMc79ZSU"):
        self.room_id = room_id
        self.video_id = initial_video_id
        self.play_state = PlayState.PAUSED
        self.current_time = 0.0          # Anchor time in seconds
        self.last_updated_at = time.time()  # Unix timestamp of last state transition
        self.host_id: Optional[str] = None
        self.participants: Dict[str, Participant] = {}

    def get_current_playback_time(self) -> float:
        """
        CRITICAL ARCHITECTURAL CONCEPT: Dynamic Drift Calculation.
        If the video is PLAYING, time moves forward every millisecond.
        Instead of constantly querying clients, the server computes the exact elapsed
        time since the last 'play' or 'seek' event was timestamped.
        """
        if self.play_state == PlayState.PLAYING:
            elapsed = time.time() - self.last_updated_at
            return round(self.current_time + elapsed, 2)
        return round(self.current_time, 2)

    def get_sync_state_payload(self) -> dict:
        """
        Generates the standard 'sync_state' event payload required by the specification.
        """
        return {
            "playState": self.play_state.value,
            "currentTime": self.get_current_playback_time(),
            "videoId": self.video_id
        }

    def get_participants_payload(self) -> List[dict]:
        """
        Returns a list of all active participants and their roles.
        """
        return [p.to_dict() for p in self.participants.values()]

    def can_control_playback(self, user_id: str) -> bool:
        """
        RBAC Guard: Only Host and Moderator can control playback (play, pause, seek, change_video).
        """
        participant = self.participants.get(user_id)
        if not participant:
            return False
        return participant.role in [Role.HOST, Role.MODERATOR]

    def is_host(self, user_id: str) -> bool:
        """
        RBAC Guard: Only Host can assign roles, remove participants, or transfer ownership.
        """
        participant = self.participants.get(user_id)
        return participant is not None and participant.role == Role.HOST

    def add_participant(self, user_id: str, username: str, websocket: WebSocket) -> Participant:
        """
        Adds a new user to the room.
        - First joiner automatically becomes Host.
        - Subsequent joiners become Participant by default.
        """
        if not self.participants:
            role = Role.HOST
            self.host_id = user_id
            logger.info(f"[Room {self.room_id}] Created by Host: {username} ({user_id})")
        else:
            role = Role.PARTICIPANT
            logger.info(f"[Room {self.room_id}] Participant joined: {username} ({user_id})")

        participant = Participant(user_id, username, role, websocket)
        self.participants[user_id] = participant
        return participant

    def remove_participant(self, user_id: str) -> Optional[Participant]:
        """
        Removes a participant on disconnect or kick.
        Handles Host succession: If Host leaves, the next oldest participant is promoted to Host!
        """
        participant = self.participants.pop(user_id, None)
        if not participant:
            return None

        logger.info(f"[Room {self.room_id}] Participant removed: {participant.username}")

        # If the departing user was the Host, automatically elect the next senior member as Host
        if self.host_id == user_id and self.participants:
            # Elect the earliest joined participant
            next_host = min(self.participants.values(), key=lambda p: p.joined_at)
            next_host.role = Role.HOST
            self.host_id = next_host.user_id
            logger.info(f"[Room {self.room_id}] Host succession: New Host is {next_host.username}")

        return participant

    def apply_play(self, user_id: str) -> bool:
        """
        Executes 'play' event with RBAC validation.
        """
        if not self.can_control_playback(user_id):
            return False
        
        # Anchor the time before toggling state
        self.current_time = self.get_current_playback_time()
        self.last_updated_at = time.time()
        self.play_state = PlayState.PLAYING
        return True

    def apply_pause(self, user_id: str) -> bool:
        """
        Executes 'pause' event with RBAC validation.
        """
        if not self.can_control_playback(user_id):
            return False

        # Freeze the current playback time
        self.current_time = self.get_current_playback_time()
        self.last_updated_at = time.time()
        self.play_state = PlayState.PAUSED
        return True

    def apply_seek(self, user_id: str, target_time: float) -> bool:
        """
        Executes 'seek' event with RBAC validation.
        """
        if not self.can_control_playback(user_id):
            return False

        self.current_time = max(0.0, float(target_time))
        self.last_updated_at = time.time()
        return True

    def apply_change_video(self, user_id: str, video_id: str) -> bool:
        """
        Executes 'change_video' event with RBAC validation.
        Resets playback counter to 0.
        """
        if not self.can_control_playback(user_id):
            return False

        self.video_id = video_id
        self.current_time = 0.0
        self.last_updated_at = time.time()
        self.play_state = PlayState.PAUSED  # Pause initially so everyone buffers cleanly
        return True

    def apply_assign_role(self, caller_user_id: str, target_user_id: str, new_role_str: str) -> bool:
        """
        Executes 'assign_role' event. Enforces Host-only authorization.
        """
        if not self.is_host(caller_user_id):
            return False

        target = self.participants.get(target_user_id)
        if not target or target_user_id == caller_user_id:
            # Cannot re-assign oneself or nonexistent user
            return False

        try:
            role_enum = Role(new_role_str)
            target.role = role_enum
            return True
        except ValueError:
            return False

    async def broadcast(self, message: dict, exclude_user_id: Optional[str] = None):
        """
        Broadcasts a JSON frame to all participants in this room.
        Automatically cleans up stale or disconnected sockets.
        """
        raw_message = json.dumps(message)
        stale_user_ids = []

        for uid, participant in self.participants.items():
            if exclude_user_id and uid == exclude_user_id:
                continue
            try:
                await participant.websocket.send_text(raw_message)
            except Exception as e:
                logger.warning(f"Failed to send to {participant.username} ({uid}): {e}")
                stale_user_ids.append(uid)

        # Cleanup any dead sockets that failed to transmit
        for uid in stale_user_ids:
            self.remove_participant(uid)

    async def send_to_user(self, user_id: str, message: dict):
        """
        Sends a private message to a specific user (e.g. initial sync or error notification).
        """
        participant = self.participants.get(user_id)
        if participant:
            try:
                await participant.websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Error sending private message to {user_id}: {e}")


class RoomManager:
    """
    Global Registry & Orchestrator for all active Watch Party rooms.
    """
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def get_or_create_room(self, room_id: str) -> Room:
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(room_id)
            logger.info(f"Initialized new Watch Party Room: {room_id}")
        return self.rooms[room_id]

    def get_room(self, room_id: str) -> Optional[Room]:
        return self.rooms.get(room_id)

    def cleanup_empty_rooms(self):
        """
        Garbage collects empty rooms to free memory.
        """
        empty_ids = [rid for rid, r in self.rooms.items() if len(r.participants) == 0]
        for rid in empty_ids:
            del self.rooms[rid]
            logger.info(f"Cleaned up empty room: {rid}")


# Global Singleton Instance
room_manager = RoomManager()
