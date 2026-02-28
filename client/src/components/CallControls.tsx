import { useRef, useEffect } from 'react';
import type { CallState, TranscriptChunk } from '../hooks/useWebRTC';

interface Props {
  callState: CallState;
  callId: string | null;
  isMuted: boolean;
  callDuration: number;
  transcriptChunks: TranscriptChunk[];
  onStartCall: () => void;
  onAcceptCall: (callId: string) => void;
  onRejectCall: (callId: string) => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallControls({
  callState,
  callId,
  isMuted,
  callDuration,
  transcriptChunks,
  onStartCall,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onToggleMute,
  compact = false,
}: Props) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptChunks.length]);

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: compact ? '50%' : '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontWeight: 600,
    fontSize: compact ? '12px' : '13px',
    transition: 'all 0.2s',
  };

  // Idle — green phone button
  if (callState === 'idle') {
    return (
      <button
        onClick={onStartCall}
        style={{
          ...btnBase,
          padding: compact ? '8px' : '8px 16px',
          background: '#22c55e',
          color: 'white',
          width: compact ? '32px' : 'auto',
          height: compact ? '32px' : 'auto',
        }}
        title="Start voice call"
      >
        <PhoneIcon size={compact ? 14 : 16} />
        {!compact && 'Call'}
      </button>
    );
  }

  // Ringing — pulsing with cancel
  if (callState === 'ringing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#22c55e',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          <PhoneIcon size={14} />
          <span>Ringing...</span>
        </div>
        <button
          onClick={onEndCall}
          style={{
            ...btnBase,
            padding: '6px 12px',
            background: '#ef4444',
            color: 'white',
          }}
        >
          Cancel
        </button>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>
    );
  }

  // Incoming — accept / reject
  if (callState === 'incoming') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          fontSize: '13px',
          color: '#f59e0b',
          animation: 'pulse 1s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <PhoneRingingIcon size={16} />
          Incoming call
        </div>
        <button
          onClick={() => callId && onAcceptCall(callId)}
          style={{
            ...btnBase,
            padding: '6px 12px',
            background: '#22c55e',
            color: 'white',
          }}
        >
          Accept
        </button>
        <button
          onClick={() => callId && onRejectCall(callId)}
          style={{
            ...btnBase,
            padding: '6px 12px',
            background: '#ef4444',
            color: 'white',
          }}
        >
          Reject
        </button>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>
    );
  }

  // Connected — timer, mute, end, transcript panel
  if (callState === 'connected') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: compact ? '100%' : 'auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#22c55e',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatDuration(callDuration)}
          </span>
          <button
            onClick={onToggleMute}
            style={{
              ...btnBase,
              padding: compact ? '6px' : '6px 12px',
              background: isMuted ? '#fbbf24' : '#f1f5f9',
              color: isMuted ? '#92400e' : '#64748b',
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOffIcon size={14} /> : <MicIcon size={14} />}
            {!compact && (isMuted ? 'Unmuted' : 'Mute')}
          </button>
          <button
            onClick={onEndCall}
            style={{
              ...btnBase,
              padding: compact ? '6px' : '6px 12px',
              background: '#ef4444',
              color: 'white',
            }}
          >
            <PhoneOffIcon size={14} />
            {!compact && 'End'}
          </button>
        </div>

        {/* Transcript panel */}
        {transcriptChunks.length > 0 && (
          <div
            ref={transcriptRef}
            style={{
              maxHeight: compact ? '120px' : '180px',
              overflowY: 'auto',
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '8px 10px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#475569',
            }}
          >
            {transcriptChunks.map((chunk, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>
                <span style={{ color: '#94a3b8', fontSize: '10px', marginRight: '6px' }}>
                  [{new Date(chunk.timestamp).toLocaleTimeString()}]
                </span>
                {chunk.text}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Ended — brief message
  if (callState === 'ended') {
    return (
      <div style={{
        fontSize: '13px',
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <PhoneOffIcon size={14} />
        Call ended
      </div>
    );
  }

  return null;
}

// ── Inline SVG icons ──────────────────────────────────────────

function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function PhoneRingingIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      <path d="M14.05 2a9 9 0 0 1 8 7.94" />
      <path d="M14.05 6A5 5 0 0 1 18 10" />
    </svg>
  );
}

function PhoneOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.36 2.18" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
