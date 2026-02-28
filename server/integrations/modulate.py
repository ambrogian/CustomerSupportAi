"""
Modulate transcription client — real-time speech-to-text via WebSocket.

Uses Modulate API if MODULATE_API_KEY is set, otherwise falls back to mock
transcription that emits fake chunks periodically.
"""
import os
import json
import threading
import time

# Optional: websocket-client for real API mode
try:
    import websocket as ws_client
    HAS_WS_CLIENT = True
except ImportError:
    HAS_WS_CLIENT = False


MODULATE_WS_URL = os.getenv(
    "MODULATE_WS_URL", "wss://api.modulate.ai/v1/transcribe"
)


class MockTranscriptionSession:
    """Emits a fake transcript chunk every ~10 audio chunks received."""

    def __init__(self, call_id: str, on_transcript_chunk):
        self.call_id = call_id
        self._on_chunk = on_transcript_chunk
        self._count = 0
        self._chunk_idx = 0
        self._closed = False

        self._mock_phrases = [
            "Hi, I need help with my order.",
            "It was supposed to arrive two days ago.",
            "Can you check the tracking status?",
            "I've been a customer for a long time.",
            "I'd really appreciate some help here.",
            "Is there anything you can do?",
            "Maybe a credit or something?",
            "Okay, that sounds fair. Thank you.",
        ]

    def send_audio(self, chunk: bytes):
        if self._closed:
            return
        self._count += 1
        if self._count % 10 == 0:
            phrase = self._mock_phrases[
                self._chunk_idx % len(self._mock_phrases)
            ]
            self._chunk_idx += 1
            self._on_chunk({
                "text": phrase,
                "isFinal": True,
                "chunkIndex": self._chunk_idx,
            })

    def close(self):
        self._closed = True


class ModulateTranscriptionSession:
    """Real Modulate WebSocket transcription session."""

    def __init__(self, call_id: str, api_key: str, on_transcript_chunk):
        self.call_id = call_id
        self._api_key = api_key
        self._on_chunk = on_transcript_chunk
        self._closed = False
        self._ws = None
        self._thread = None
        self._connect()

    def _connect(self):
        url = f"{MODULATE_WS_URL}?api_key={self._api_key}"

        def on_message(ws, message):
            try:
                data = json.loads(message)
                self._on_chunk(data)
            except json.JSONDecodeError:
                pass

        def on_error(ws, error):
            print(f"[Modulate] WebSocket error for call {self.call_id}: {error}")
            self._closed = True

        def on_close(ws, close_status_code, close_msg):
            print(f"[Modulate] WebSocket closed for call {self.call_id}")
            self._closed = True

        def on_open(ws):
            ws.send(json.dumps({
                "type": "config",
                "callId": self.call_id,
                "sampleRate": 16000,
                "encoding": "pcm_s16le",
            }))

        self._ws = ws_client.WebSocketApp(
            url,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open,
        )
        self._thread = threading.Thread(
            target=self._ws.run_forever, daemon=True
        )
        self._thread.start()

    def send_audio(self, chunk: bytes):
        if self._closed or not self._ws:
            return
        try:
            self._ws.send(chunk, opcode=0x2)  # binary frame
        except Exception:
            pass

    def close(self):
        self._closed = True
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass


def start_transcription_session(call_id: str, on_transcript_chunk):
    """
    Start a transcription session for the given call.
    Returns a session object with send_audio(chunk) and close() methods.

    Uses real Modulate API if MODULATE_API_KEY is set and websocket-client is
    installed; otherwise falls back to mock.
    """
    api_key = os.getenv("MODULATE_API_KEY")

    if api_key and HAS_WS_CLIENT:
        try:
            print(f"[Modulate] Starting real transcription for call {call_id}")
            session = ModulateTranscriptionSession(call_id, api_key, on_transcript_chunk)
            # Give the WebSocket a moment to connect; fall back to mock if it fails
            time.sleep(0.5)
            if session._closed or session._ws is None:
                raise ConnectionError("WebSocket failed to connect")
            return session
        except Exception as e:
            print(f"[Modulate] Real API failed ({e}), falling back to mock")

    print(f"[Modulate] Starting mock transcription for call {call_id}")
    return MockTranscriptionSession(call_id, on_transcript_chunk)
