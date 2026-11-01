import { useCurrentFrame, useVideoConfig, interpolate, Audio, staticFile } from 'remotion';
import { Captions } from './Captions';
import type { CaptionWord } from './Captions';

// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint.
export type ShortProps = {
  title: string;
  subtitle: string;
  clientMax: number;
  cacheNodeName: string;
  cacheKey: string;
  cacheStatus: string;
  cacheTtl: string;
  dbMax: number;
  dbStatus: string;
  audioFile: string;
  durationSeconds: number;
  // Times (seconds) when each concept happens in the voiceover.
  // A null dbOverload means the DB never overloads; a null shield or checklist means that element is not shown.
  beats: {
    cacheBreak: number;
    dbOverload: number | null;
    shield: number | null;
    checklist: number | null;
  };
  shieldLabel?: string;
  checklistItems?: string[];
  captions: CaptionWord[];
};

export const SystemDesignShort = ({
  title,
  subtitle,
  clientMax,
  cacheNodeName,
  cacheKey,
  cacheStatus,
  cacheTtl,
  dbMax,
  dbStatus,
  audioFile,
  durationSeconds,
  beats,
  shieldLabel,
  checklistItems,
  captions,
}: ShortProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const cacheBreakAt = beats.cacheBreak;
  const dbOverloadAt = beats.dbOverload;
  const shieldAt = beats.shield;
  const checklistAt = beats.checklist;
  const rampEnd = dbOverloadAt ?? durationSeconds;

  // Dynamic animations
  const clientRequests = Math.floor(
    interpolate(t, [0, cacheBreakAt, rampEnd], [100, clientMax * 0.3, clientMax], {
      extrapolateRight: 'clamp',
    })
  );

  const isCacheBroken = t >= cacheBreakAt;
  const isDbOverloaded = dbOverloadAt !== null && t >= dbOverloadAt;
  const isShielded = shieldAt !== null && t >= shieldAt;

  const dbQueries = isShielded
    ? 1
    : Math.floor(
        interpolate(t, [cacheBreakAt, rampEnd], [0, dbMax], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      );

  const shieldOpacity = shieldAt === null
    ? 0
    : interpolate(t, [shieldAt, shieldAt + 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const checklistOpacity = checklistAt === null
    ? 0
    : interpolate(t, [checklistAt, checklistAt + 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0a0f18',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '100px 50px 320px',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
      backgroundSize: '36px 36px',
    }}>
      <Audio src={staticFile(audioFile)} />

      {/* Top Hook */}
      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <h1 style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, margin: 0 }}>
          {title}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '24px', marginTop: '16px' }}>
          {subtitle}
        </p>
      </div>

      {/* Node 1: Client Requests */}
      <div style={{
        width: '100%',
        maxWidth: '650px',
        border: '2px solid rgba(6, 182, 212, 0.7)',
        backgroundColor: '#0f172a',
        borderRadius: '20px',
        padding: '28px',
        textAlign: 'center',
        boxShadow: '0 0 25px rgba(6, 182, 212, 0.2)',
      }}>
        <div style={{ color: '#22d3ee', fontSize: '22px', fontWeight: 700, letterSpacing: '1px' }}>
          CLIENT REQUESTS · SAME KEY
        </div>
        <div style={{ fontSize: '70px', fontWeight: 900, marginTop: '8px' }}>
          {clientRequests.toLocaleString()}
        </div>
      </div>

      <div style={{ color: '#22d3ee', fontSize: '36px' }}>↓</div>

      {/* Node 2: App Servers */}
      <div style={{
        width: '100%',
        maxWidth: '650px',
        border: '2px solid rgba(59, 130, 246, 0.7)',
        backgroundColor: '#0f172a',
        borderRadius: '20px',
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{ color: '#60a5fa', fontSize: '28px', fontWeight: 800 }}>APP SERVERS</div>
        <div style={{ color: '#94a3b8', fontSize: '18px', marginTop: '4px' }}>CACHE-ASIDE PATTERN</div>
      </div>

      <div style={{ color: isCacheBroken ? '#f59e0b' : '#38bdf8', fontSize: '36px' }}>↓</div>

      {/* Node 3: Cache Node */}
      <div style={{
        width: '100%',
        maxWidth: '650px',
        border: `2px solid ${isCacheBroken ? '#f59e0b' : '#10b981'}`,
        backgroundColor: isCacheBroken ? 'rgba(69, 26, 3, 0.5)' : '#0f172a',
        borderRadius: '20px',
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{ color: isCacheBroken ? '#fbbf24' : '#34d399', fontSize: '26px', fontWeight: 800 }}>
          {cacheNodeName}
        </div>
        <div style={{ fontFamily: 'monospace', color: '#e2e8f0', fontSize: '20px', marginTop: '6px' }}>
          {cacheKey}
        </div>
        <div style={{
          display: 'inline-block',
          marginTop: '10px',
          padding: '6px 20px',
          borderRadius: '9999px',
          fontSize: '18px',
          fontWeight: 700,
          backgroundColor: isCacheBroken ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
          color: isCacheBroken ? '#fde68a' : '#a7f3d0',
        }}>
          {isCacheBroken ? `${cacheTtl} · ${cacheStatus}` : 'TTL: 60s · HEALTHY'}
        </div>
      </div>

      {/* Shield between the app layer and the database (fixed slot so the layout does not jump) */}
      {shieldAt !== null && (
        <div style={{
          width: '100%',
          maxWidth: '650px',
          opacity: shieldOpacity,
          border: '2px solid #22c55e',
          backgroundColor: 'rgba(20, 83, 45, 0.4)',
          borderRadius: '20px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 0 30px rgba(34, 197, 94, 0.35)',
        }}>
          <div style={{ color: '#4ade80', fontSize: '24px', fontWeight: 800 }}>
            🛡️ {shieldLabel ?? 'SHIELD'}
          </div>
        </div>
      )}

      <div style={{
        color: isDbOverloaded && !isShielded ? '#ef4444' : '#64748b',
        fontSize: '36px',
        fontWeight: 'bold',
      }}>
        {isDbOverloaded && !isShielded ? '↓↓↓ MASSIVE OVERLOAD ↓↓↓' : '↓'}
      </div>

      {/* Node 4: Database Queries */}
      <div style={{
        width: '100%',
        maxWidth: '650px',
        border: `2px solid ${isShielded ? '#22c55e' : isDbOverloaded ? '#ef4444' : '#334155'}`,
        backgroundColor: isDbOverloaded && !isShielded ? 'rgba(69, 10, 10, 0.6)' : '#0f172a',
        borderRadius: '20px',
        padding: '28px',
        textAlign: 'center',
        boxShadow: isDbOverloaded && !isShielded ? '0 0 35px rgba(239, 68, 68, 0.4)' : 'none',
      }}>
        <div style={{ color: '#f87171', fontSize: '22px', fontWeight: 700 }}>DATABASE QUERIES</div>
        <div style={{
          fontSize: '70px',
          fontWeight: 900,
          marginTop: '8px',
          color: isShielded ? '#4ade80' : isDbOverloaded ? '#ef4444' : '#ffffff',
        }}>
          {dbQueries.toLocaleString()}
        </div>
        <div style={{ color: '#cbd5e1', fontSize: '18px', marginTop: '6px' }}>
          {isShielded
            ? 'ONLY 1 REQUEST THROUGH · REST WAIT'
            : isDbOverloaded ? dbStatus : 'LOW LOAD · CACHE SERVES READS'}
        </div>
      </div>

      {/* Checklist (fixed slot at the bottom, above the captions) */}
      {checklistAt !== null && (
        <div style={{
          width: '100%',
          maxWidth: '650px',
          opacity: checklistOpacity,
          border: '2px solid #22c55e',
          backgroundColor: '#0f172a',
          borderRadius: '20px',
          padding: '24px 28px',
        }}>
          <div style={{ color: '#4ade80', fontSize: '22px', fontWeight: 800, marginBottom: '10px' }}>
            ✅ CHECKLIST
          </div>
          {(checklistItems ?? []).map((item) => (
            <div key={item} style={{ fontSize: '24px', color: '#e2e8f0', marginTop: '6px' }}>
              ☐ {item}
            </div>
          ))}
        </div>
      )}

      <Captions captions={captions} t={t} />
    </div>
  );
};
