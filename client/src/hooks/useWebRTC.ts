import { useState, useRef, useCallback, useEffect } from 'react';
import type { Socket } from 'socket.io-client';

export type CallState = 'idle' | 'ringing' | 'incoming' | 'connected' | 'ended';

export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  chunkIndex: number;
  timestamp: string;
}

export interface IncomingCallInfo {
  callId: string;
  from: string;
  customerName?: string;
}

interface UseWebRTCOptions {
  socket: Socket | null;
  role: 'customer' | 'agent';
  customerId?: string;
  /** Pass the parent's incoming call data so the hook can sync even if it missed the socket event */
  incomingCall?: IncomingCallInfo | null;
}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC({ socket, role, customerId, incomingCall }: UseWebRTCOptions) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [callId, setCallId] = useState<string | null>(null);

  // Refs so socket listeners always see current values without re-registering
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Create a persistent hidden audio element for remote playback
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    remoteAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.srcObject = null;
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (_) {}
      pcRef.current = null;
    }
  }, []);

  // Start capturing PCM audio chunks and emitting to server
  const startAudioCapture = useCallback((stream: MediaStream) => {
    if (!socket) return;
    const ctx = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!socket?.connected) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      socket.emit('audio_chunk', pcm.buffer);
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  }, [socket]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('call_ice', { candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current && e.streams[0]) {
        remoteAudioRef.current.srcObject = e.streams[0];
      }
    };

    return pc;
  }, [socket]);

  const startCall = useCallback(async (targetCustomerId?: string) => {
    if (!socket || callStateRef.current !== 'idle') return;
    setCallState('ringing');
    setTranscriptChunks([]);
    setCallDuration(0);

    socket.emit('call_initiate', {
      targetCustomerId: targetCustomerId || customerId,
    });
  }, [socket, customerId]);

  const acceptCall = useCallback(async (incomingCallId: string) => {
    if (!socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      setCallId(incomingCallId);
      setCallState('connected');
      setTranscriptChunks([]);

      const start = Date.now();
      timerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - start) / 1000));
      }, 1000);

      startAudioCapture(stream);

      socket.emit('call_accept', { callId: incomingCallId });
    } catch (err) {
      console.error('[WebRTC] Failed to get microphone:', err);
      setCallState('idle');
    }
  }, [socket, createPeerConnection, startAudioCapture]);

  const rejectCall = useCallback((incomingCallId: string) => {
    if (!socket) return;
    socket.emit('call_reject', { callId: incomingCallId });
    setCallState('idle');
  }, [socket]);

  const endCall = useCallback(() => {
    if (!socket) return;
    socket.emit('call_end', { callId });
    cleanup();
    setCallState('ended');
    setTimeout(() => setCallState('idle'), 3000);
  }, [socket, callId, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  // Sync with parent's incomingCall prop — covers the case where the socket
  // event was missed due to listener teardown or timing
  useEffect(() => {
    if (incomingCall && callStateRef.current === 'idle') {
      setCallId(incomingCall.callId);
      setCallState('incoming');
    }
    if (!incomingCall && callStateRef.current === 'incoming') {
      // Parent cleared it (call was rejected/ended externally)
      setCallState('idle');
    }
  }, [incomingCall]);

  // Socket event listeners — registered once per socket, no callState dependency
  useEffect(() => {
    if (!socket) return;

    const onCallIncoming = (data: { callId: string; from: string; customerName?: string }) => {
      setCallId(data.callId);
      setCallState('incoming');
    };

    const onCallStarted = async (data: { callId: string }) => {
      if (callStateRef.current !== 'ringing') return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        const pc = createPeerConnection();
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call_offer', { sdp: pc.localDescription });

        setCallId(data.callId);
        setCallState('connected');

        const start = Date.now();
        timerRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - start) / 1000));
        }, 1000);

        startAudioCapture(stream);
      } catch (err) {
        console.error('[WebRTC] Failed to get microphone:', err);
        setCallState('idle');
      }
    };

    const onCallRejected = () => {
      cleanup();
      setCallState('idle');
    };

    const onCallOffer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call_answer', { sdp: pc.localDescription });
    };

    const onCallAnswer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    };

    const onCallIce = async (data: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[WebRTC] ICE candidate error:', err);
      }
    };

    const onCallEnded = () => {
      cleanup();
      setCallState('ended');
      setTimeout(() => setCallState('idle'), 3000);
    };

    const onTranscriptChunk = (data: { text: string; isFinal: boolean; chunkIndex: number }) => {
      setTranscriptChunks(prev => [...prev, {
        ...data,
        timestamp: new Date().toISOString(),
      }]);
    };

    socket.on('call_incoming', onCallIncoming);
    socket.on('call_started', onCallStarted);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_offer', onCallOffer);
    socket.on('call_answer', onCallAnswer);
    socket.on('call_ice', onCallIce);
    socket.on('call_ended', onCallEnded);
    socket.on('transcript_chunk', onTranscriptChunk);

    return () => {
      socket.off('call_incoming', onCallIncoming);
      socket.off('call_started', onCallStarted);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_offer', onCallOffer);
      socket.off('call_answer', onCallAnswer);
      socket.off('call_ice', onCallIce);
      socket.off('call_ended', onCallEnded);
      socket.off('transcript_chunk', onTranscriptChunk);
    };
  }, [socket, createPeerConnection, startAudioCapture, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    callState,
    callId,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    isMuted,
    callDuration,
    transcriptChunks,
  };
}
