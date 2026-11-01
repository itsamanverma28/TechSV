import { useCurrentFrame, useVideoConfig, interpolate, spring, Audio, Sequence, staticFile } from 'remotion';
import { Captions } from './Captions';
import type { CaptionWord } from './Captions';
import { LockIcon, GaugeIcon } from './ExplainerScene';

// Generic "director" player. A timeline of visual events (from a topic's `visual_timeline`) drives the camera,
// highlights, actions and sound effects. generate_batch.py resolves each event's beat name into `time`.
// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint.
export type DirectorNode = {
  id: string;
  label: string;
  sub?: string;
  color: string;
  x: number; // centre, in canvas pixels (1080 x 1920)
  y: number;
};

export type DirectorEvent = {
  time: number; // seconds (resolved from the event's beat by generate_batch.py)
  camera?: { zoom?: number; focus?: string; shake?: boolean }; // focus is a node id or "center"
  highlight_node?: string | null; // null clears the highlight
  action?: 'TITLE_PUNCH' | 'LOCK_SNAP' | 'GAUGE_MAX' | 'NODE_FAILOVER' | 'PACKET_BURST';
  metric?: { label: string; value?: string; status?: string; barPercent?: number };
  details?: string;
  sfx?: 'pop' | 'whoosh' | 'thud';
};

export type DirectorSceneProps = {
  audioFile: string;
  durationSeconds: number;
  title: string;
  subtitle: string;
  nodes: DirectorNode[];
  edges: string[][]; // pairs of node ids joined by a flow line
  timeline: DirectorEvent[];
  captions: CaptionWord[];
};

const CENTER = { x: 540, y: 960 };
const CARD_W = 300;
const CARD_H = 170;
const CAMERA_BLEND = 0.6; // seconds for a camera move to settle
const ACTION_LIFE = 5; // seconds an action or metric stays on screen after its event
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SPRING_CONFIG = { damping: 12, mass: 0.5, stiffness: 120 };

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

export const DirectorScene = ({ audioFile, title, subtitle, nodes, edges, timeline, captions }: DirectorSceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const nodeById = new Map<string, DirectorNode>(nodes.map((node) => [node.id, node] as [string, DirectorNode]));
  const focusPoint = (focus?: string) => {
    const node = focus ? nodeById.get(focus) : undefined;
    return node ? { x: node.x, y: node.y } : CENTER;
  };
  const cameraOf = (event?: DirectorEvent) => ({
    zoom: event?.camera?.zoom ?? 1,
    focus: focusPoint(event?.camera?.focus),
  });

  // Camera: blend from the previous event's camera to the current one
  let activeIndex = -1;
  timeline.forEach((event, index) => {
    if (t >= event.time) {
      activeIndex = index;
    }
  });
  const active = activeIndex >= 0 ? timeline[activeIndex] : undefined;
  const from = cameraOf(activeIndex > 0 ? timeline[activeIndex - 1] : undefined);
  const to = cameraOf(active);
  const blend = active ? easeOut(interpolate(t - active.time, [0, CAMERA_BLEND], [0, 1], CLAMP)) : 1;
  const zoom = from.zoom + (to.zoom - from.zoom) * blend;
  const focusX = from.focus.x + (to.focus.x - from.focus.x) * blend;
  const focusY = from.focus.y + (to.focus.y - from.focus.y) * blend;

  // Shake: deterministic jitter for 0.8s after the latest event that asks for it
  const shakeEvent = timeline.filter((event) => event.time <= t && event.camera?.shake).pop();
  const shakeAmount = shakeEvent && t - shakeEvent.time < 0.8 ? 14 * (1 - (t - shakeEvent.time) / 0.8) : 0;
  const shakeX = shakeAmount * Math.sin(frame * 2.7);
  const shakeY = shakeAmount * Math.cos(frame * 3.1);

  // Highlight persists until the next event that sets highlight_node (null clears it)
  let highlight: string | null = null;
  for (const event of timeline) {
    if (t >= event.time && event.highlight_node !== undefined) {
      highlight = event.highlight_node;
    }
  }

  const live = active !== undefined && t - active.time < ACTION_LIFE;
  const liveAction = live ? active?.action : undefined;
  const liveMetric = live ? active?.metric : undefined;
  const liveDetails = live ? active?.details : undefined;
  const sinceActive = active ? t - active.time : 0;
  const pop = spring({ frame: Math.max(0, frame - (active?.time ?? 0) * fps), fps, config: SPRING_CONFIG });

  const highlightedNode = highlight ? nodeById.get(highlight) : undefined;
  const iconX = highlightedNode?.x ?? CENTER.x;
  const iconY = highlightedNode ? highlightedNode.y - CARD_H / 2 - 200 : CENTER.y;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#05070c',
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(56, 189, 248, 0.10), transparent 55%)',
    }}>
      <Audio src={staticFile(audioFile)} />

      {timeline.map((event, index) => event.sfx && (
        <Sequence key={index} from={Math.round(event.time * fps)} durationInFrames={Math.round(2 * fps)}>
          <Audio src={staticFile(`sfx/${event.sfx}.wav`)} volume={0.6} />
        </Sequence>
      ))}

      {/* Title (punches in on TITLE_PUNCH) */}
      <div style={{ position: 'absolute', top: 150, left: 70, right: 70, textAlign: 'center' }}>
        <div style={{
          fontSize: '80px',
          fontWeight: 900,
          lineHeight: 1.1,
          transform: `scale(${liveAction === 'TITLE_PUNCH' ? interpolate(pop, [0, 1], [1.3, 1]) : 1})`,
        }}>
          {title}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '28px', marginTop: '16px' }}>{subtitle}</div>
      </div>

      {/* Camera: everything in the diagram is moved and scaled together */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: '0 0',
        transform: `translate(${CENTER.x - focusX * zoom + shakeX}px, ${CENTER.y - focusY * zoom + shakeY}px) scale(${zoom})`,
      }}>
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {edges.map(([fromId, toId]) => {
            const a = nodeById.get(fromId);
            const b = nodeById.get(toId);
            if (!a || !b) {
              return null;
            }
            return (
              <line
                key={`${fromId}-${toId}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#334155"
                strokeWidth={4}
                strokeDasharray="12 10"
                strokeDashoffset={-frame * 2}
              />
            );
          })}
        </svg>

        {/* Packets flowing along the edges during PACKET_BURST */}
        {liveAction === 'PACKET_BURST' && edges.flatMap(([fromId, toId], edgeIndex) => {
          const a = nodeById.get(fromId);
          const b = nodeById.get(toId);
          if (!a || !b) {
            return [];
          }
          return Array.from({ length: 6 }, (_, packetIndex) => {
            const phase = (sinceActive * 0.6 + (packetIndex + edgeIndex * 0.37) / 6) % 1;
            return (
              <div key={`${edgeIndex}-${packetIndex}`} style={{
                position: 'absolute',
                left: a.x + (b.x - a.x) * phase - 8,
                top: a.y + (b.y - a.y) * phase - 8,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#38bdf8',
                boxShadow: '0 0 16px #38bdf8, 0 0 32px #0284c7',
              }} />
            );
          });
        })}

        {nodes.map((node) => {
          const isHighlight = highlight === node.id;
          const failed = isHighlight && liveAction === 'NODE_FAILOVER';
          const color = failed ? '#64748b' : node.color;
          const scale = isHighlight ? interpolate(pop, [0, 1], [1, 1.08]) : 1;
          return (
            <div key={node.id} style={{
              position: 'absolute',
              left: node.x - CARD_W / 2,
              top: node.y - CARD_H / 2,
              width: `${CARD_W}px`,
              height: `${CARD_H}px`,
              boxSizing: 'border-box',
              transform: `scale(${scale})`,
              opacity: failed ? 0.6 : 1,
              border: `3px solid ${color}`,
              borderRadius: '22px',
              backgroundColor: '#0f172a',
              boxShadow: isHighlight && !failed ? `0 0 40px ${color}` : 'none',
              padding: '22px',
              textAlign: 'center',
            }}>
              <div style={{ color, fontSize: '34px', fontWeight: 900 }}>{node.label}</div>
              {node.sub && <div style={{ color: '#94a3b8', fontSize: '22px', marginTop: '6px' }}>{node.sub}</div>}
              {failed && (
                <div style={{
                  marginTop: '14px',
                  display: 'inline-block',
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  backgroundColor: '#7f1d1d',
                  color: '#fecaca',
                  fontSize: '22px',
                  fontWeight: 800,
                }}>
                  ✕ DOWN
                </div>
              )}
            </div>
          );
        })}

        {/* Icon above the highlighted node */}
        {liveAction === 'LOCK_SNAP' && highlightedNode && (
          <div style={{ position: 'absolute', left: iconX - 80, top: iconY, width: 160 }}>
            <LockIcon progress={pop} />
          </div>
        )}
        {liveAction === 'GAUGE_MAX' && highlightedNode && (
          <div style={{ position: 'absolute', left: iconX - 160, top: iconY, width: 320 }}>
            <GaugeIcon value={((active?.metric?.barPercent ?? 50) / 100) * pop} />
          </div>
        )}
      </div>

      {/* Metric card (fixed position, shown while its event is live) */}
      {liveMetric && (
        <div style={{
          position: 'absolute',
          left: 110,
          right: 110,
          top: 1080,
          border: '2px solid #38bdf8',
          borderRadius: '20px',
          backgroundColor: '#0f172a',
          padding: '26px 30px',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}>
          <div style={{ color: '#7dd3fc', fontSize: '24px', fontWeight: 800, letterSpacing: '2px' }}>{liveMetric.label}</div>
          <div style={{ fontSize: '64px', fontWeight: 900, marginTop: '8px' }}>
            {liveMetric.value ?? liveMetric.status}
          </div>
          {liveMetric.barPercent !== undefined && (
            <div style={{ marginTop: '14px', height: '26px', borderRadius: '13px', backgroundColor: '#1e293b', overflow: 'hidden' }}>
              <div style={{
                width: `${liveMetric.barPercent * interpolate(sinceActive, [0, 0.8], [0, 1], CLAMP)}%`,
                height: '100%',
                backgroundColor: '#38bdf8',
              }} />
            </div>
          )}
        </div>
      )}

      {liveDetails && (
        <div style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 1220,
          textAlign: 'center',
          border: '2px solid #f87171',
          borderRadius: '16px',
          backgroundColor: '#1f0a0a',
          color: '#fca5a5',
          fontSize: '28px',
          fontWeight: 800,
          padding: '18px 20px',
          boxSizing: 'border-box',
        }}>
          {liveDetails}
        </div>
      )}

      <Captions captions={captions} t={t} />
    </div>
  );
};
