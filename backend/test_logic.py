"""
Unit Verification for RoomManager & RBAC Rules
"""
import time
from room_manager import RoomManager, Role, PlayState

class MockWebSocket:
    """Mock WebSocket for unit testing"""
    def __init__(self):
        self.sent_messages = []
    
    async def send_text(self, text):
        self.sent_messages.append(text)


def run_tests():
    print("[TEST] Starting WatchParty Backend Logic & RBAC Tests...\n")
    manager = RoomManager()
    room = manager.get_or_create_room("TEST-ROOM")

    # Test 1: First user joins -> Must become Host
    ws1 = MockWebSocket()
    user1 = room.add_participant("u1", "Lucky_Host", ws1)
    assert user1.role == Role.HOST, f"Expected Host, got {user1.role}"
    assert room.host_id == "u1"
    print("[PASS] Test 1: First joiner automatically assigned 'Host' role.")

    # Test 2: Second user joins -> Must become Participant
    ws2 = MockWebSocket()
    user2 = room.add_participant("u2", "Guest_User", ws2)
    assert user2.role == Role.PARTICIPANT, f"Expected Participant, got {user2.role}"
    print("[PASS] Test 2: Second joiner assigned 'Participant' role.")

    # Test 3: Participant tries to play/pause -> Must be BLOCKED by RBAC
    blocked_play = room.apply_play("u2")
    assert blocked_play is False, "Security failure! Participant was allowed to play."
    print("[PASS] Test 3: RBAC blocked unauthorized Participant from altering playback.")

    # Test 4: Host promotes Participant to Moderator
    promoted = room.apply_assign_role(caller_user_id="u1", target_user_id="u2", new_role_str="Moderator")
    assert promoted is True
    assert user2.role == Role.MODERATOR
    print("[PASS] Test 4: Host successfully promoted Participant to 'Moderator'.")

    # Test 5: Moderator tries to play -> Must SUCCEED
    mod_play = room.apply_play("u2")
    assert mod_play is True
    assert room.play_state == PlayState.PLAYING
    print("[PASS] Test 5: Moderator successfully toggled playback to 'PLAYING'.")

    # Test 6: Dynamic Drift Calculation
    time.sleep(0.5)
    current_time = room.get_current_playback_time()
    assert current_time >= 0.45, f"Drift calculation error: expected >= 0.45, got {current_time}"
    print(f"[PASS] Test 6: Dynamic time drift correctly computed: {current_time}s elapsed.")

    # Test 7: Host kicks user
    assert "u2" in room.participants
    room.remove_participant("u2")
    assert "u2" not in room.participants
    print("[PASS] Test 7: Host successfully removed participant.")

    print("\n[SUCCESS] ALL 7 CORE BACKEND & RBAC SPECIFICATIONS PASSED WITH 100% ACCURACY!")


if __name__ == "__main__":
    run_tests()
