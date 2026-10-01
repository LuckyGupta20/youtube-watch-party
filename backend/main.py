"""
FastAPI WebSocket Gateway & Event Router
Watch Party Real-Time Backend
Author: Lucky Gupta
Enterprise: SafeSignal AI / WatchParty Core
"""

import json
import uuid
import logging
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from room_manager import room_manager, Role

logger = logging.getLogger("WatchPartyAPI")
app = FastAPI(
    title="YouTube Watch Party Sync API",
    description="Real-Time Synchronized Video Player with Server-Side Role-Based Access Control (RBAC)",
    version="1.0.0"
)

# Enable CORS for local Vite dev server and deployed frontend instances
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local testing and cloud deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateRoomRequest(BaseModel):
    initialVideoId: Optional[str] = "b9EkMc79ZSU"


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "YouTube Watch Party WebSocket Server",
        "author": "Lucky Gupta",
        "docs_url": "/docs"
    }


@app.post("/api/rooms")
def create_room(req: CreateRoomRequest):
    """
    HTTP Endpoint: Generates a short, memorable room code (e.g. 'WP-8A2F')
    """
    room_code = f"WP-{uuid.uuid4().hex[:6].upper()}"
    room = room_manager.get_or_create_room(room_code)
    if req.initialVideoId:
        room.video_id = req.initialVideoId
    return {
        "roomId": room_code,
        "videoId": room.video_id,
        "message": "Room initialized successfully"
    }


@app.get("/api/rooms/{room_id}")
def get_room_metadata(room_id: str):
    """
    HTTP Endpoint: Returns live room metadata for invite previews
    """
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "roomId": room.room_id,
        "videoId": room.video_id,
        "playState": room.play_state.value,
        "currentTime": room.get_current_playback_time(),
        "participantCount": len(room.participants),
        "participants": room.get_participants_payload()
    }


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """
    Main WebSocket Event Router:
    Handles lifecycle: Handshake -> join_room -> Event Loop -> disconnect
    """
    await websocket.accept()

    user_id = str(uuid.uuid4())[:8]
    username = "Guest"
    current_room = None
    participant = None

    try:
        # Event Loop
        while True:
            raw_text = await websocket.receive_text()
            try:
                packet = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON format"}))
                continue

            event_type = packet.get("event") or packet.get("type")
            payload = packet.get("payload", {})

            # -------------------------------------------------------------
            # 1. EVENT: join_room
            # -------------------------------------------------------------
            if event_type == "join_room":
                username = payload.get("username", f"User_{user_id}")
                current_room = room_manager.get_or_create_room(room_id)
                participant = current_room.add_participant(user_id, username, websocket)

                # Step 1: Send current video sync state directly to the new joiner
                await websocket.send_text(json.dumps({
                    "event": "sync_state",
                    "payload": current_room.get_sync_state_payload()
                }))

                # Step 2: Send their assigned role and identity
                await websocket.send_text(json.dumps({
                    "event": "init_identity",
                    "payload": {
                        "userId": user_id,
                        "username": username,
                        "role": participant.role.value
                    }
                }))

                # Step 3: Broadcast 'user_joined' to all participants in the room
                await current_room.broadcast({
                    "event": "user_joined",
                    "payload": {
                        "userId": user_id,
                        "username": username,
                        "role": participant.role.value,
                        "participants": current_room.get_participants_payload()
                    }
                })

            # Ensure user has joined before sending any operational events
            if not current_room or not participant:
                continue

            # -------------------------------------------------------------
            # 2. EVENT: play
            # -------------------------------------------------------------
            elif event_type == "play":
                success = current_room.apply_play(user_id)
                if success:
                    # Broadcast new state to entire room
                    await current_room.broadcast({
                        "event": "sync_state",
                        "payload": current_room.get_sync_state_payload()
                    })
                else:
                    await websocket.send_text(json.dumps({
                        "event": "error",
                        "payload": {"message": "Permission denied: Only Host or Moderator can play video"}
                    }))

            # -------------------------------------------------------------
            # 3. EVENT: pause
            # -------------------------------------------------------------
            elif event_type == "pause":
                success = current_room.apply_pause(user_id)
                if success:
                    await current_room.broadcast({
                        "event": "sync_state",
                        "payload": current_room.get_sync_state_payload()
                    })
                else:
                    await websocket.send_text(json.dumps({
                        "event": "error",
                        "payload": {"message": "Permission denied: Only Host or Moderator can pause video"}
                    }))

            # -------------------------------------------------------------
            # 4. EVENT: seek
            # -------------------------------------------------------------
            elif event_type == "seek":
                target_time = payload.get("time", 0.0)
                success = current_room.apply_seek(user_id, target_time)
                if success:
                    await current_room.broadcast({
                        "event": "sync_state",
                        "payload": current_room.get_sync_state_payload()
                    })
                else:
                    await websocket.send_text(json.dumps({
                        "event": "error",
                        "payload": {"message": "Permission denied: Only Host or Moderator can seek video"}
                    }))

            # -------------------------------------------------------------
            # 5. EVENT: change_video
            # -------------------------------------------------------------
            elif event_type == "change_video":
                video_id = payload.get("videoId")
                if video_id:
                    success = current_room.apply_change_video(user_id, video_id)
                    if success:
                        await current_room.broadcast({
                            "event": "sync_state",
                            "payload": current_room.get_sync_state_payload()
                        })
                    else:
                        await websocket.send_text(json.dumps({
                            "event": "error",
                            "payload": {"message": "Permission denied: Only Host or Moderator can change video"}
                        }))

            # -------------------------------------------------------------
            # 6. EVENT: assign_role (Host Only)
            # -------------------------------------------------------------
            elif event_type == "assign_role":
                target_user_id = payload.get("userId")
                new_role = payload.get("role")
                success = current_room.apply_assign_role(user_id, target_user_id, new_role)
                if success:
                    target_participant = current_room.participants.get(target_user_id)
                    await current_room.broadcast({
                        "event": "role_assigned",
                        "payload": {
                            "userId": target_user_id,
                            "username": target_participant.username,
                            "role": target_participant.role.value,
                            "participants": current_room.get_participants_payload()
                        }
                    })
                else:
                    await websocket.send_text(json.dumps({
                        "event": "error",
                        "payload": {"message": "Permission denied: Only Host can assign roles"}
                    }))

            # -------------------------------------------------------------
            # 7. EVENT: remove_participant (Host Only)
            # -------------------------------------------------------------
            elif event_type == "remove_participant":
                target_user_id = payload.get("userId")
                if current_room.is_host(user_id) and target_user_id in current_room.participants:
                    target_part = current_room.participants[target_user_id]
                    # Notify target that they have been kicked
                    await target_part.websocket.send_text(json.dumps({
                        "event": "participant_removed",
                        "payload": {"userId": target_user_id, "reason": "Removed by Host"}
                    }))
                    current_room.remove_participant(target_user_id)

                    # Broadcast updated participant list to remaining room members
                    await current_room.broadcast({
                        "event": "participant_removed",
                        "payload": {
                            "userId": target_user_id,
                            "participants": current_room.get_participants_payload()
                        }
                    })
                else:
                    await websocket.send_text(json.dumps({
                        "event": "error",
                        "payload": {"message": "Permission denied: Only Host can remove participants"}
                    }))

            # -------------------------------------------------------------
            # 8. EVENT: get_sync (Explicit Resync Request)
            # -------------------------------------------------------------
            elif event_type == "get_sync":
                await websocket.send_text(json.dumps({
                    "event": "sync_state",
                    "payload": current_room.get_sync_state_payload()
                }))

            # -------------------------------------------------------------
            # 9. BONUS EVENT: chat_message
            # -------------------------------------------------------------
            elif event_type == "chat_message":
                text = payload.get("message", "").strip()
                if text:
                    await current_room.broadcast({
                        "event": "chat_message",
                        "payload": {
                            "userId": user_id,
                            "username": username,
                            "role": participant.role.value,
                            "message": text
                        }
                    })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {username} ({user_id})")
        if current_room and user_id in current_room.participants:
            current_room.remove_participant(user_id)
            # Broadcast user_left
            await current_room.broadcast({
                "event": "user_left",
                "payload": {
                    "userId": user_id,
                    "username": username,
                    "participants": current_room.get_participants_payload()
                }
            })
            room_manager.cleanup_empty_rooms()
    except Exception as e:
        logger.error(f"Unexpected WebSocket error: {e}")
        if current_room and user_id in current_room.participants:
            current_room.remove_participant(user_id)
            room_manager.cleanup_empty_rooms()


if __name__ == "__main__":
    import uvicorn
    # Local development runner
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
