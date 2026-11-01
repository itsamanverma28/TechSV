import { useCurrentFrame, useVideoConfig, interpolate, Audio, staticFile } from 'remotion';
import { Captions } from './Captions';
import type { CaptionWord } from './Captions';

// Generic scene: draws any flow of boxes (rows top to bottom) from a spec in topics.json.
// Everything that changes over time is tied to a beat name from the topic's `beats`.
// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint.
export type NodeSpec = {
  id: string;
  label: string;
  sub?: string;
  color: string;
};

export type StateSpec = {
  node: string; // node id
  at: string; // beat name
  color?: string; // border and label colour from this beat onward
  badge?: string; // pill text from this beat onward
};

export type CounterSpec = {
  node: string; // node id
  label: string;
  from: number;
  to: number;
  start?: string | null; // beat name where the count starts (null = video start)
  end?: string | null; // beat name where the count reaches `to` (null = video end)
};

export type SceneSpec = {
  nodes: NodeSpec[];
  rows: string[][]; // each inner array is one row of node ids, drawn side by side
  states?: StateSpec[];
  counters?: CounterSpec[];
  summary?: { at: string; text: string };
};

export type ConceptSceneProps = {
  title: string;
  subtitle: string;
  audioFile: string;
  durationSeconds: number;
  beats: Record<string, number | null>;
  scene: SceneSpec;
  captions: CaptionWord[];
};

const ROW_WIDTH = 900;
const NODE_GAP = 30;
const MAX_NODE_WIDTH = 420;

const fadeIn = (t: number, at: number | null, length = 0.5) =>
  at === null
    ? 0
    : interpolate(t, [at, at + length], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const ConceptScene = ({ title, subtitle, audioFile, beats, scene, captions }: ConceptSceneProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const videoEnd = durationInFrames / fps;

  const beatTime = (name: string | null | undefined): number | null =>
    name === null || name === undefined ? null : (beats[name] ?? null);

  // Latest state for each node whose beat has been reached
  const activeState = (nodeId: string): StateSpec | undefined => {
    let latest: StateSpec | undefined;
    let latestTime = -1;
    for (const state of scene.states ?? []) {
      const at = beatTime(state.at);
      if (state.node === nodeId && at !== null && t >= at && at >= latestTime) {
        latest = state;
        latestTime = at;
      }
    }
    return latest;
  };

  const counterValue = (counter: CounterSpec) => {
    const start = beatTime(counter.start) ?? 0;
    const end = beatTime(counter.end) ?? videoEnd;
    if (end <= start) {
      return t >= end ? counter.to : counter.from;
    }
    return Math.round(interpolate(t, [start, end], [counter.from, counter.to], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }));
  };

  const nodeById = new Map<string, NodeSpec>(scene.nodes.map((node) => [node.id, node] as [string, NodeSpec]));
  const summaryOpacity = fadeIn(t, beatTime(scene.summary?.at), 0.6);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0a0f18',
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
      backgroundSize: '36px 36px',
    }}>
      <Audio src={staticFile(audioFile)} />

      {/* Title */}
      <div style={{ position: 'absolute', top: 100, left: 0, right: 0, textAlign: 'center', padding: '0 50px' }}>
        <div style={{ fontSize: '72px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>{title}</div>
        <div style={{ color: '#94a3b8', fontSize: '26px', marginTop: '14px' }}>{subtitle}</div>
      </div>

      {/* Diagram: rows stacked top to bottom */}
      <div style={{
        position: 'absolute',
        top: 360,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '18px',
      }}>
        {scene.rows.map((row, rowIndex) => {
          const width = Math.min(MAX_NODE_WIDTH, (ROW_WIDTH - (row.length - 1) * NODE_GAP) / row.length);
          return (
            <div key={rowIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {rowIndex > 0 && <div style={{ color: '#38bdf8', fontSize: '34px', lineHeight: 1 }}>↓</div>}
              <div style={{ display: 'flex', gap: `${NODE_GAP}px`, justifyContent: 'center', marginTop: '10px' }}>
                {row.map((nodeId) => {
                  const node = nodeById.get(nodeId);
                  if (!node) {
                    throw new Error(`Scene row references unknown node '${nodeId}'`);
                  }
                  const state = activeState(nodeId);
                  const color = state?.color ?? node.color;
                  const counters = (scene.counters ?? []).filter((counter) => counter.node === nodeId);
                  return (
                    <div key={nodeId} style={{
                      width: `${width}px`,
                      boxSizing: 'border-box',
                      border: `2px solid ${color}`,
                      backgroundColor: state ? `${color}1f` : '#0f172a',
                      borderRadius: '20px',
                      padding: '22px 20px',
                      textAlign: 'center',
                      boxShadow: state ? `0 0 28px ${color}55` : 'none',
                    }}>
                      <div style={{ color, fontSize: '28px', fontWeight: 900 }}>{node.label}</div>
                      {node.sub && <div style={{ color: '#94a3b8', fontSize: '19px', marginTop: '4px' }}>{node.sub}</div>}
                      {state?.badge && (
                        <div style={{
                          display: 'inline-block',
                          marginTop: '10px',
                          padding: '5px 16px',
                          borderRadius: '9999px',
                          fontSize: '18px',
                          fontWeight: 800,
                          backgroundColor: `${color}33`,
                          color: '#f8fafc',
                        }}>
                          {state.badge}
                        </div>
                      )}
                      {counters.map((counter) => (
                        <div key={counter.label} style={{ marginTop: '10px' }}>
                          <div style={{ color: '#cbd5e1', fontSize: '18px', fontWeight: 700 }}>{counter.label}</div>
                          <div style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1.1 }}>
                            {counterValue(counter).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary card */}
      {scene.summary && (
        <div style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 1260,
          opacity: summaryOpacity,
          border: '2px solid #facc15',
          borderRadius: '20px',
          backgroundColor: '#0f172a',
          padding: '24px 30px',
          textAlign: 'center',
          fontSize: '30px',
          fontWeight: 800,
          lineHeight: 1.35,
          boxSizing: 'border-box',
        }}>
          {scene.summary.text}
        </div>
      )}

      <Captions captions={captions} t={t} />
    </div>
  );
};
