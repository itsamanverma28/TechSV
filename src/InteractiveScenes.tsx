import { interpolate } from 'remotion';
import type { ReactNode } from 'react';
import type { SceneItem, CodeLine } from './ExplainerScene';

// Reusable interactive mechanics for explainer scenes. Every time here is in seconds from the start of the scene.
// Each component positions itself in the content area (top 640) and takes the scene's local time.
const CONTENT_TOP = 640;
const STEP_TIME = 0.8; // how long an item shows "PROCESSING" before its result
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const easeOut = (k: number) => 1 - Math.pow(1 - Math.min(Math.max(k, 0), 1), 3);

// 1. Cause and effect: each item runs in turn, a failing item triggers a rollback of the ones that succeeded
export const Checklist = ({ items, localTime, rollbackAt }: {
  items: SceneItem[];
  localTime: number;
  rollbackAt?: number;
}) => {
  const rolledBack = rollbackAt !== undefined && localTime >= rollbackAt;
  const pulse = rolledBack ? Math.max(0, 1 - (localTime - (rollbackAt ?? 0)) / 0.9) : 0;

  return (
    <>
      <div style={{ position: 'absolute', top: CONTENT_TOP, left: 70, right: 150, display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {items.map((item, index) => {
          const start = item.delay ?? index * 1.5;
          let status = { label: 'PENDING', color: '#64748b', icon: '○' };
          if (localTime >= start && localTime < start + STEP_TIME) {
            status = { label: 'PROCESSING…', color: '#fb923c', icon: '◐' };
          } else if (localTime >= start + STEP_TIME) {
            status = item.fail
              ? { label: '500 ERROR', color: '#ef4444', icon: '✕' }
              : { label: 'DONE', color: '#4ade80', icon: '✓' };
            if (rolledBack && !item.fail) {
              status = { label: 'ROLLED BACK', color: '#fbbf24', icon: '↺' };
            }
          }
          return (
            <div key={item.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              border: `2px solid ${status.color}`,
              borderRadius: '20px',
              backgroundColor: '#0f172a',
              padding: '24px 28px',
              boxSizing: 'border-box',
            }}>
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                border: `3px solid ${status.color}`,
                color: status.color,
                fontSize: '40px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {status.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '38px', fontWeight: 900 }}>{item.label}</div>
                {item.sub && <div style={{ color: '#94a3b8', fontSize: '22px', marginTop: '4px' }}>{item.sub}</div>}
              </div>
              <div style={{
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: `${status.color}26`,
                color: status.color,
                fontSize: '22px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}>
                {status.label}
              </div>
            </div>
          );
        })}
      </div>

      {rolledBack && (
        <div style={{
          position: 'absolute',
          left: 70,
          right: 150,
          top: 1110,
          textAlign: 'center',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          backgroundColor: '#450a0a',
          color: '#fecaca',
          fontSize: '34px',
          fontWeight: 900,
          padding: '18px',
          boxSizing: 'border-box',
        }}>
          ROLLBACK TRIGGERED! ↺
        </div>
      )}

      {pulse > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundColor: `rgba(239, 68, 68, ${0.35 * pulse})`,
        }} />
      )}
    </>
  );
};

// 2. Live terminal: lines are typed one character at a time, with simple syntax colours
const TOKEN_PATTERN = '("[^"]*")|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:SELECT|FROM|JOIN|WHERE|ON|TABLE|CREATE|INSERT|UPDATE|AND|OR)\\b)';

const highlight = (text: string, base: string): ReactNode[] => {
  const pattern = new RegExp(TOKEN_PATTERN, 'g');
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > last) {
      parts.push(<span key={key++} style={{ color: base }}>{text.slice(last, match.index)}</span>);
    }
    let color = '#e2e8f0';
    if (match[1] !== undefined) {
      // a quoted key is followed by a colon in JSON; any other quoted text is a string
      color = text[match.index + match[0].length] === ':' ? '#67e8f9' : '#fbbf24';
    } else if (match[2] !== undefined) {
      color = '#a78bfa';
    } else {
      color = '#f472b6';
    }
    parts.push(<span key={key++} style={{ color }}>{match[0]}</span>);
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length) {
    parts.push(<span key={key++} style={{ color: base }}>{text.slice(last)}</span>);
  }
  return parts;
};

export const Terminal = ({ lines, localTime, speed = 26 }: { lines: CodeLine[]; localTime: number; speed?: number }) => {
  let typingIndex = -1;
  const shown = lines.map((line, index) => {
    const start = line.start ?? index * 0.9;
    const chars = Math.floor(Math.max(0, (localTime - start) * speed));
    if (localTime >= start && chars < line.text.length) {
      typingIndex = index;
    }
    return line.text.slice(0, chars);
  });
  const cursorVisible = Math.floor(localTime * 2) % 2 === 0;

  return (
    <div style={{
      position: 'absolute',
      top: CONTENT_TOP,
      left: 70,
      right: 150,
      backgroundColor: '#0b1220',
      border: '2px solid #1e293b',
      borderRadius: '20px',
      padding: '40px 36px',
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontSize: '34px',
      lineHeight: 1.6,
      boxSizing: 'border-box',
    }}>
      {lines.map((line, index) => (
        <div key={index} style={{ whiteSpace: 'pre', minHeight: '1.6em' }}>
          {highlight(shown[index], line.color ?? '#e2e8f0')}
          {index === typingIndex && <span style={{ color: '#ffffff' }}>{cursorVisible ? '▍' : ' '}</span>}
        </div>
      ))}
    </div>
  );
};

// 3. Node cluster: traffic goes to the chosen node, which then crashes; the packet reroutes along a curve to node 1
export const Cluster = ({ nodes, localTime, failAt, crash }: {
  nodes: SceneItem[];
  localTime: number;
  failAt: number;
  crash: number;
}) => {
  const xs = [180, 540, 900];
  const nodeY = 900;
  const hub = { x: 540, y: 1180 };
  const failed = localTime >= failAt;
  const badge = failed ? interpolate(localTime - failAt, [0, 0.3], [0, 1], CLAMP) : 0;

  const travel = (localTime * 0.5) % 1;
  let packetX: number;
  let packetY: number;
  if (!failed || localTime < failAt + 0.4) {
    const target = { x: xs[crash], y: nodeY };
    packetX = hub.x + (target.x - hub.x) * travel;
    packetY = hub.y + (target.y - hub.y) * travel;
  } else {
    // quadratic curve from the hub to node 1, bending out to the left
    const target = { x: xs[0], y: nodeY };
    const control = { x: 170, y: 1080 };
    const u = 1 - travel;
    packetX = u * u * hub.x + 2 * u * travel * control.x + travel * travel * target.x;
    packetY = u * u * hub.y + 2 * u * travel * control.y + travel * travel * target.y;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
        {nodes.slice(0, 3).map((_, index) => (
          <line
            key={index}
            x1={hub.x}
            y1={hub.y}
            x2={xs[index]}
            y2={nodeY}
            stroke={failed && index === crash ? '#7f1d1d' : '#334155'}
            strokeWidth={4}
            strokeDasharray={failed && index === crash ? '6 10' : undefined}
          />
        ))}
        {failed && (
          <path
            d={`M ${hub.x} ${hub.y} Q 170 1080 ${xs[0]} ${nodeY}`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={3}
            strokeDasharray="10 10"
            opacity={0.6}
          />
        )}
      </svg>

      {nodes.slice(0, 3).map((node, index) => {
        const isCrashed = failed && index === crash;
        const color = isCrashed ? '#64748b' : '#38bdf8';
        return (
          <div key={node.label} style={{
            position: 'absolute',
            left: xs[index] - 95,
            top: nodeY - 95,
            width: '190px',
            height: '190px',
            borderRadius: '50%',
            border: `4px solid ${isCrashed ? '#ef4444' : color}`,
            backgroundColor: '#0f172a',
            opacity: isCrashed ? 0.5 : 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}>
            <div style={{ fontSize: '30px', fontWeight: 900, color: isCrashed ? '#fca5a5' : '#e0f2fe' }}>{node.label}</div>
            {node.sub && <div style={{ fontSize: '20px', color: '#94a3b8', marginTop: '4px' }}>{node.sub}</div>}
            {isCrashed && (
              <div style={{
                position: 'absolute',
                top: -58,
                padding: '8px 18px',
                borderRadius: '12px',
                backgroundColor: '#7f1d1d',
                color: '#fecaca',
                fontSize: '26px',
                fontWeight: 900,
                transform: `scale(${badge})`,
                whiteSpace: 'nowrap',
              }}>
                ⚡ CRASH
              </div>
            )}
          </div>
        );
      })}

      <div style={{
        position: 'absolute',
        left: packetX - 13,
        top: packetY - 13,
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        backgroundColor: '#38bdf8',
        boxShadow: '0 0 18px #38bdf8, 0 0 36px #0284c7',
      }} />
    </div>
  );
};

// 4. Live counter: ticks from one value to another (for example a DB read at 120 ms dropping to a Redis read at 0.2 ms)
export const Counter = ({ from, to, unit, duration, label, decimals, color, localTime }: {
  from: number;
  to: number;
  unit: string;
  duration: number;
  label: string;
  decimals?: number;
  color?: string;
  localTime: number;
}) => {
  const value = from + (to - from) * easeOut(localTime / duration);
  const text = value.toFixed(decimals ?? (Math.abs(to) < 1 ? 1 : 0));
  const barWidth = (value / from) * 100;
  return (
    <div style={{
      position: 'absolute',
      top: CONTENT_TOP + 40,
      left: 70,
      right: 150,
      border: `2px solid ${color ?? '#22c55e'}`,
      borderRadius: '24px',
      backgroundColor: '#0f172a',
      padding: '50px 40px',
      textAlign: 'center',
      boxSizing: 'border-box',
    }}>
      <div style={{ color: '#94a3b8', fontSize: '28px', fontWeight: 800, letterSpacing: '2px' }}>{label}</div>
      <div style={{ fontSize: '150px', fontWeight: 900, lineHeight: 1.1, color: color ?? '#22c55e' }}>
        {text}
        <span style={{ fontSize: '60px' }}>{unit}</span>
      </div>
      <div style={{ height: '26px', borderRadius: '13px', backgroundColor: '#1e293b', overflow: 'hidden', marginTop: '20px' }}>
        <div style={{ width: `${Math.max(barWidth, 0.5)}%`, height: '100%', backgroundColor: color ?? '#22c55e' }} />
      </div>
    </div>
  );
};

// 5. Toggle switches: each item slides from OFF to ON at its delay (items with on: false stay OFF)
export const Toggles = ({ items, localTime }: { items: SceneItem[]; localTime: number }) => (
  <div style={{ position: 'absolute', top: CONTENT_TOP, left: 70, right: 150, display: 'flex', flexDirection: 'column', gap: '40px' }}>
    {items.map((item, index) => {
      const start = item.delay ?? index * 1.2;
      const shouldBeOn = item.on ?? true;
      const progress = shouldBeOn ? interpolate(localTime, [start, start + 0.35], [0, 1], CLAMP) : 0;
      return (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div style={{
            width: '140px',
            height: '76px',
            borderRadius: '38px',
            backgroundColor: progress > 0.5 ? '#14532d' : '#1e293b',
            border: `2px solid ${progress > 0.5 ? '#22c55e' : '#475569'}`,
            position: 'relative',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}>
            <div style={{
              position: 'absolute',
              top: 8,
              left: 8 + progress * 56,
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: progress > 0.5 ? '#4ade80' : '#94a3b8',
            }} />
          </div>
          <div>
            <div style={{ fontSize: '38px', fontWeight: 900 }}>{item.label}</div>
            {item.sub && <div style={{ color: '#94a3b8', fontSize: '24px', marginTop: '4px' }}>{item.sub}</div>}
          </div>
        </div>
      );
    })}
  </div>
);

// 5b. Race: each lane's packet runs to the finish line in its own time; the timer climbs to that lane's latency
export type RaceLane = { label: string; color: string; seconds: number; ms: number };

export const Race = ({ lanes, localTime }: { lanes: RaceLane[]; localTime: number }) => (
  <div style={{ position: 'absolute', top: CONTENT_TOP, left: 70, right: 150, display: 'flex', flexDirection: 'column', gap: '44px' }}>
    {lanes.map((lane) => {
      const progress = Math.min(1, Math.max(0, localTime / lane.seconds));
      const finished = localTime >= lane.seconds;
      const timer = (lane.ms * progress).toFixed(lane.ms < 1 ? 1 : 0);
      return (
        <div key={lane.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '30px', fontWeight: 900 }}>
            <span style={{ color: lane.color }}>{lane.label}</span>
            <span style={{ fontSize: '46px', color: finished && lane.ms < 1 ? '#4ade80' : '#ffffff' }}>
              {timer} ms
            </span>
          </div>
          <div style={{ position: 'relative', marginTop: '12px', height: '64px', borderRadius: '32px', backgroundColor: '#1e293b' }}>
            <div style={{
              position: 'absolute',
              left: `calc(${progress * 100}% - 26px)`,
              top: 6,
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: lane.color,
              boxShadow: `0 0 18px ${lane.color}, 0 0 36px ${lane.color}88`,
            }} />
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '6px',
              height: '64px',
              borderRadius: '3px',
              backgroundColor: '#f8fafc',
            }} />
          </div>
          {finished && lane.ms < 1 && (
            <div style={{ marginTop: '10px', color: '#4ade80', fontSize: '24px', fontWeight: 800 }}>WINNER · {lane.ms} ms</div>
          )}
        </div>
      );
    })}
  </div>
);

// 6. Tap cursor: glides to a point, presses, and sends a ripple out
export const CursorClick = ({ x, y, at, localTime }: { x: number; y: number; at: number; localTime: number }) => {
  if (localTime < at - 0.7) {
    return null;
  }
  const approach = interpolate(localTime, [at - 0.7, at], [0, 1], CLAMP);
  const cursorX = x + (1 - approach) * 220;
  const cursorY = y + (1 - approach) * 260;
  const pressed = localTime >= at && localTime < at + 0.12;
  const ripple = interpolate(localTime, [at, at + 0.5], [0, 1], CLAMP);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {localTime >= at && (
        <div style={{
          position: 'absolute',
          left: x - 60,
          top: y - 60,
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          border: '4px solid #ffffff',
          opacity: 1 - ripple,
          transform: `scale(${0.2 + ripple * 1.6})`,
        }} />
      )}
      <svg
        width="48"
        height="60"
        viewBox="0 0 24 30"
        style={{ position: 'absolute', left: cursorX, top: cursorY, transform: `scale(${pressed ? 0.85 : 1})` }}
      >
        <path d="M2 2 L2 24 L8 18 L12 28 L15 26.5 L11 17 L19 17 Z" fill="#ffffff" stroke="#000000" strokeWidth={1.5} />
      </svg>
    </div>
  );
};
