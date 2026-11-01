import { useCurrentFrame, useVideoConfig, interpolate, spring, Audio, Sequence, staticFile } from 'remotion';
import { Captions } from './Captions';
import type { CaptionWord } from './Captions';
import { MobileSafeZone } from './MobileSafeZone';
import { Checklist, Terminal, Cluster, Counter, Toggles, Race, CursorClick } from './InteractiveScenes';

// Generic multi-scene explainer. Each scene starts at its beat and lasts until the next scene starts.
// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint.
export type SceneItem = {
  label: string;
  sub?: string;
  color?: string;
  check?: boolean; // show a green tick (used by the steps kind)
  delay?: number; // seconds after the scene starts (checklist, toggle)
  fail?: boolean; // checklist: this item returns an error and triggers the rollback
  on?: boolean; // toggle: final state (default ON)
};

export type CodeLine = {
  text: string;
  color?: string;
  start?: number; // terminal: second when this line starts typing (default: 0.9s apart)
};

export type BarSpec = {
  label: string;
  value: number;
  max: number;
  color?: string;
  note?: string;
};

export type HeroSpec = {
  emoji?: string;
  title: string;
  sub?: string;
  stat?: string; // big number, e.g. "0.2 ms"
  statLabel?: string;
  barPercent?: number; // 0 to 100, bar under the stat
  badge?: string; // pill text at the bottom of the card
  color: string;
};

export type ExplainerSceneSpec = {
  beat: string | null; // beat name where this scene starts (null = video start)
  kind: 'headline' | 'cards' | 'steps' | 'code' | 'bars' | 'cta' | 'hero' | 'checklist' | 'terminal' | 'cluster' | 'toggle' | 'counter' | 'race';
  race?: { lanes: { label: string; color: string; seconds: number; ms: number }[] }; // race: lanes run side by side
  hero?: HeroSpec; // used by the hero kind: one big centre-stage card
  rollbackAt?: number; // checklist: second when a failure rolls back the items that succeeded
  typeSpeed?: number; // terminal: characters per second
  cluster?: { failAt: number; crash: number }; // cluster: when node `crash` (0 to 2) goes down
  counter?: { from: number; to: number; unit: string; duration: number; label: string; decimals?: number; color?: string };
  cursor?: { x: number; y: number; at: number }; // tap cursor that clicks at (x, y) at second `at`
  tag?: string;
  title: string;
  body?: string;
  items?: SceneItem[];
  code?: CodeLine[];
  bars?: BarSpec[];
  banner?: string;
  zoom?: number; // camera zoom reached during this scene (1 = none), e.g. 1.2 when explaining one component
  shake?: boolean; // short shake on impact moments such as a crash or overload
  particles?: number; // number of glowing packets flowing down the screen
  icon?: 'lock' | 'gauge'; // vector icon shown above the content
  iconValue?: number; // 0 to 1, needle position for the gauge icon
  sfx?: 'pop' | 'whoosh' | 'thud'; // sound effect played when the scene starts (files in public/sfx/)
};

export type ExplainerSceneProps = {
  audioFile: string;
  durationSeconds: number;
  beats: Record<string, number | null>;
  scenes: ExplainerSceneSpec[];
  captions: CaptionWord[];
  showSafeZone?: boolean; // preview only: draws the platform UI areas over the video
};

const ACCENT = '#fb923c';
const MUTED = '#94a3b8';
const CONTENT_TOP = 640;
const ICON_OFFSET = 230; // space taken by an icon above the content
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SPRING_CONFIG = { damping: 12, mass: 0.5, stiffness: 120 };

// Spring pop-in: 0 before the delay, overshoots slightly past 1, then settles at 1
const popIn = (localFrame: number, fps: number, delaySeconds: number) =>
  spring({ frame: Math.max(0, localFrame - delaySeconds * fps), fps, config: SPRING_CONFIG });

// Delay (seconds after the scene starts) for the i-th element
const delayFor = (index: number) => 0.3 + index * 0.35;

const fadeFrom = (progress: number) => interpolate(progress, [0, 0.3], [0, 1], CLAMP);

const Header = ({ scene }: { scene: ExplainerSceneSpec }) => (
  <div style={{ position: 'absolute', top: 260, left: 70, right: 150 }}>
    {scene.tag && (
      <div style={{
        display: 'inline-block',
        border: `1px solid ${ACCENT}`,
        color: ACCENT,
        fontSize: '22px',
        fontWeight: 700,
        letterSpacing: '2px',
        padding: '6px 16px',
        borderRadius: '6px',
      }}>
        {scene.tag}
      </div>
    )}
    <div style={{ fontSize: '76px', fontWeight: 900, lineHeight: 1.1, marginTop: '24px' }}>
      {scene.title}
    </div>
    {scene.body && (
      <div style={{ fontSize: '32px', color: MUTED, marginTop: '20px', lineHeight: 1.35 }}>{scene.body}</div>
    )}
  </div>
);

const Banner = ({ text }: { text: string }) => (
  <div style={{
    position: 'absolute',
    left: 70,
    right: 150,
    top: 1260,
    textAlign: 'center',
    border: `2px solid ${ACCENT}`,
    borderRadius: '16px',
    backgroundColor: '#1c1408',
    color: ACCENT,
    fontSize: '28px',
    fontWeight: 800,
    padding: '18px 20px',
    boxSizing: 'border-box',
  }}>
    {text}
  </div>
);

// Padlock whose shackle drops in and snaps shut (used for the ACID scene)
export const LockIcon = ({ progress }: { progress: number }) => {
  const shackleY = interpolate(progress, [0, 1], [-40, 0]);
  return (
    <svg width="160" height="190" viewBox="0 0 160 190">
      <path
        d="M48 86 V56 a32 32 0 0 1 64 0 V86"
        transform={`translate(0 ${shackleY})`}
        fill="none"
        stroke={ACCENT}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="22" y="84" width="116" height="100" rx="16" fill="#1c1408" stroke={ACCENT} strokeWidth="6" />
      <circle cx="80" cy="122" r="10" fill={ACCENT} />
      <rect x="76" y="122" width="8" height="24" fill={ACCENT} />
    </svg>
  );
};

// Speedometer dial whose needle swings to `value` (0 to 1)
export const GaugeIcon = ({ value }: { value: number }) => {
  const angle = -90 + 180 * Math.min(Math.max(value, 0), 1);
  const arc = 'M30 170 A130 130 0 0 1 290 170';
  return (
    <svg width="320" height="190" viewBox="0 0 320 190">
      <path d={arc} fill="none" stroke="#1e293b" strokeWidth="26" strokeLinecap="round" />
      <path
        d={arc}
        fill="none"
        stroke="#22c55e"
        strokeWidth="26"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${Math.max(value, 0) * 100} 100`}
      />
      <line
        x1="160"
        y1="170"
        x2="160"
        y2="60"
        stroke="#f8fafc"
        strokeWidth="8"
        strokeLinecap="round"
        transform={`rotate(${angle} 160 170)`}
      />
      <circle cx="160" cy="170" r="12" fill="#f8fafc" />
    </svg>
  );
};

// Glowing packets falling down the screen, at different speeds and offsets
const Particles = ({ count, localTime }: { count: number; localTime: number }) => (
  <>
    {Array.from({ length: count }, (_, index) => {
      const left = 120 + ((index * 397) % 840);
      const speed = 0.35 + (index % 3) * 0.12;
      const top = ((localTime * speed + index * 0.21) % 1) * 1920;
      return (
        <div key={index} style={{
          position: 'absolute',
          left,
          top,
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: '#38bdf8',
          boxShadow: '0 0 16px #38bdf8, 0 0 32px #0284c7',
        }} />
      );
    })}
  </>
);

// Centre-stage card: 3D tilt, glass background, gentle float and a breathing neon border
const HeroCard = ({ hero, localFrame, fps }: { hero: HeroSpec; localFrame: number; fps: number }) => {
  const enter = popIn(localFrame, fps, 0.2);
  const float = Math.sin(localFrame / 15) * 8;
  const glow = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(localFrame / 10));
  return (
    <div style={{
      position: 'absolute',
      top: 600,
      left: 80,
      right: 80,
      height: 620,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '50px 40px',
        textAlign: 'center',
        opacity: fadeFrom(enter),
        transform: `perspective(1200px) rotateX(12deg) rotateY(-4deg) translateY(${float}px) scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        border: `3px solid ${hero.color}`,
        borderRadius: '32px',
        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 ${35 * glow}px ${hero.color}66`,
      }}>
        {hero.emoji && <div style={{ fontSize: '90px', lineHeight: 1.1 }}>{hero.emoji}</div>}
        <div style={{ fontSize: '58px', fontWeight: 900, color: hero.color, marginTop: '10px' }}>{hero.title}</div>
        {hero.sub && <div style={{ fontSize: '26px', color: '#cbd5e1', fontWeight: 700, marginTop: '10px' }}>{hero.sub}</div>}
        {hero.stat && <div style={{ fontSize: '100px', fontWeight: 900, marginTop: '20px', lineHeight: 1.1 }}>{hero.stat}</div>}
        {hero.statLabel && <div style={{ fontSize: '24px', color: MUTED, letterSpacing: '2px' }}>{hero.statLabel}</div>}
        {hero.barPercent !== undefined && (
          <div style={{ width: '80%', height: '16px', margin: '24px auto 0', borderRadius: '8px', backgroundColor: '#334155', overflow: 'hidden' }}>
            <div style={{
              width: `${hero.barPercent * enter}%`,
              height: '100%',
              backgroundColor: hero.color,
              boxShadow: `0 0 15px ${hero.color}`,
            }} />
          </div>
        )}
        {hero.badge && (
          <div style={{
            display: 'inline-block',
            marginTop: '30px',
            padding: '12px 28px',
            borderRadius: '16px',
            backgroundColor: `${hero.color}33`,
            color: '#f8fafc',
            fontSize: '26px',
            fontWeight: 800,
          }}>
            {hero.badge}
          </div>
        )}
      </div>
    </div>
  );
};

const SceneBody = ({ scene, localTime, localFrame, fps }: {
  scene: ExplainerSceneSpec;
  localTime: number;
  localFrame: number;
  fps: number;
}) => {
  const top = CONTENT_TOP + (scene.icon ? ICON_OFFSET : 0);

  const icon = scene.icon === 'lock'
    ? <LockIcon progress={popIn(localFrame, fps, 0.2)} />
    : scene.icon === 'gauge'
      ? <GaugeIcon value={(scene.iconValue ?? 0.5) * popIn(localFrame, fps, 0.2)} />
      : null;

  const iconLayer = icon && (
    <div style={{ position: 'absolute', top: CONTENT_TOP - 40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      {icon}
    </div>
  );

  switch (scene.kind) {
    case 'headline':
    case 'cta':
      return null;

    case 'hero':
      return scene.hero ? <HeroCard hero={scene.hero} localFrame={localFrame} fps={fps} /> : null;

    case 'checklist':
      return <Checklist items={scene.items ?? []} localTime={localTime} rollbackAt={scene.rollbackAt} />;

    case 'terminal':
      return <Terminal lines={scene.code ?? []} localTime={localTime} speed={scene.typeSpeed} />;

    case 'cluster':
      return scene.cluster ? (
        <Cluster nodes={scene.items ?? []} localTime={localTime} failAt={scene.cluster.failAt} crash={scene.cluster.crash} />
      ) : null;

    case 'toggle':
      return <Toggles items={scene.items ?? []} localTime={localTime} />;

    case 'counter':
      return scene.counter ? <Counter {...scene.counter} localTime={localTime} /> : null;

    case 'race':
      return scene.race ? <Race lanes={scene.race.lanes} localTime={localTime} /> : null;

    case 'cards':
      return (
        <>
          {iconLayer}
          <div style={{ position: 'absolute', top, left: 70, right: 150, display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            {(scene.items ?? []).map((item, index) => {
              const progress = popIn(localFrame, fps, delayFor(index));
              const color = item.color ?? ACCENT;
              return (
                <div key={item.label} style={{
                  width: 'calc(50% - 12px)',
                  boxSizing: 'border-box',
                  opacity: fadeFrom(progress),
                  transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
                  border: `2px solid ${color}`,
                  borderRadius: '20px',
                  backgroundColor: '#0f172a',
                  padding: '28px 24px',
                  minHeight: '170px',
                }}>
                  <div style={{ color, fontSize: '34px', fontWeight: 900 }}>{item.label}</div>
                  {item.sub && <div style={{ color: MUTED, fontSize: '24px', marginTop: '10px', lineHeight: 1.3 }}>{item.sub}</div>}
                </div>
              );
            })}
          </div>
        </>
      );

    case 'steps':
      return (
        <>
          {iconLayer}
          <div style={{ position: 'absolute', top, left: 70, right: 150, display: 'flex', flexDirection: 'column', gap: '34px' }}>
            {(scene.items ?? []).map((item, index) => {
              const progress = popIn(localFrame, fps, delayFor(index));
              return (
                <div key={item.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '28px',
                  opacity: fadeFrom(progress),
                  transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
                  transformOrigin: 'left center',
                }}>
                  <div style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    backgroundColor: item.check ? '#14532d' : '#1e293b',
                    color: '#4ade80',
                    fontSize: '46px',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {item.check ? '✓' : ''}
                  </div>
                  <div>
                    <div style={{ fontSize: '46px', fontWeight: 900 }}>{item.label}</div>
                    {item.sub && <div style={{ color: MUTED, fontSize: '26px', marginTop: '4px' }}>{item.sub}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );

    case 'code':
      return (
        <>
          {iconLayer}
          <div style={{
            position: 'absolute',
            top,
            left: 70,
            right: 150,
            backgroundColor: '#0b1220',
            border: '2px solid #1e293b',
            borderRadius: '20px',
            padding: '40px 36px',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '36px',
            lineHeight: 1.6,
          }}>
            {(scene.code ?? []).map((line, index) => {
              const progress = popIn(localFrame, fps, delayFor(index));
              return (
                <div key={index} style={{ color: line.color ?? '#e2e8f0', opacity: fadeFrom(progress), whiteSpace: 'pre' }}>
                  {line.text}
                </div>
              );
            })}
          </div>
        </>
      );

    case 'bars':
      return (
        <>
          {iconLayer}
          <div style={{ position: 'absolute', top, left: 70, right: 150, display: 'flex', flexDirection: 'column', gap: '60px' }}>
            {(scene.bars ?? []).map((bar, index) => {
              const color = bar.color ?? ACCENT;
              const grow = interpolate(localTime, [delayFor(index), delayFor(index) + 0.8], [0, 1], CLAMP);
              return (
                <div key={bar.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '28px', fontWeight: 800 }}>
                    <span>{bar.label}</span>
                    {bar.note && <span style={{ color }}>{bar.note}</span>}
                  </div>
                  <div style={{ marginTop: '14px', height: '34px', borderRadius: '17px', backgroundColor: '#1e293b', overflow: 'hidden' }}>
                    <div style={{ width: `${(bar.value / bar.max) * 100 * grow}%`, height: '100%', backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
  }
};

export const ExplainerScene = ({ audioFile, beats, scenes, captions, showSafeZone = false }: ExplainerSceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const starts = scenes.map((scene) => (scene.beat === null ? 0 : (beats[scene.beat] ?? 0)));
  let activeIndex = 0;
  starts.forEach((start, index) => {
    if (t >= start) {
      activeIndex = index;
    }
  });
  const scene = scenes[activeIndex];
  const localTime = t - starts[activeIndex];
  const localFrame = Math.round(localTime * fps);
  const enter = interpolate(localTime, [0, 0.3], [0, 1], CLAMP);

  // Virtual camera: zoom toward the scene's zoom level, a slow drift, and a short shake on impact
  const zoomProgress = interpolate(localTime, [0, 1.2], [0, 1], CLAMP);
  const drift = interpolate(localTime, [0, 8], [1, 1.02], CLAMP);
  const cameraScale = (1 + ((scene.zoom ?? 1) - 1) * zoomProgress) * drift;
  const shakeAmount = scene.shake && localTime < 0.8 ? 12 * (1 - localTime / 0.8) : 0;
  const shakeX = shakeAmount * Math.sin(frame * 2.7);
  const shakeY = shakeAmount * Math.cos(frame * 3.1);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#05070c',
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: 'radial-gradient(circle at 50% 35%, rgba(251, 146, 60, 0.12), transparent 55%)',
    }}>
      <Audio src={staticFile(audioFile)} />

      {/* Cyber grid that keeps moving so the screen never freezes */}
      <div style={{
        position: 'absolute',
        inset: '-60px 0 0 0',
        pointerEvents: 'none',
        transform: `translateY(${(frame * 1.5) % 60}px)`,
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div key={activeIndex} style={{ position: 'absolute', inset: 0, opacity: enter }}>
        {scene.sfx && (
          <Sequence from={Math.round(starts[activeIndex] * fps)}>
            <Audio src={staticFile(`sfx/${scene.sfx}.wav`)} volume={0.6} />
          </Sequence>
        )}

        <div style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '50% 40%',
          transform: `translate(${shakeX}px, ${shakeY}px) scale(${cameraScale})`,
        }}>
          {scene.particles ? <Particles count={scene.particles} localTime={localTime} /> : null}

          {scene.kind === 'headline' || scene.kind === 'cta' ? (
            <div style={{ position: 'absolute', top: 520, left: 70, right: 150, textAlign: 'center' }}>
              {scene.tag && (
                <div style={{ color: ACCENT, fontSize: '26px', fontWeight: 700, letterSpacing: '2px' }}>{scene.tag}</div>
              )}
              <div style={{
                fontSize: scene.kind === 'headline' ? '120px' : '104px',
                fontWeight: 900,
                lineHeight: 1.05,
                marginTop: '20px',
              }}>
                {scene.title}
              </div>
              {scene.body && <div style={{ color: MUTED, fontSize: '36px', marginTop: '30px', lineHeight: 1.35 }}>{scene.body}</div>}
            </div>
          ) : null}

          <SceneBody scene={scene} localTime={localTime} localFrame={localFrame} fps={fps} />
          {scene.cursor && <CursorClick x={scene.cursor.x} y={scene.cursor.y} at={scene.cursor.at} localTime={localTime} />}
        </div>

        {/* Title and banner stay still while the camera zooms the content */}
        {scene.kind !== 'headline' && scene.kind !== 'cta' && <Header scene={scene} />}
        {scene.banner && <Banner text={scene.banner} />}
      </div>

      <MobileSafeZone show={showSafeZone} />
      <Captions captions={captions} t={t} />
    </div>
  );
};
