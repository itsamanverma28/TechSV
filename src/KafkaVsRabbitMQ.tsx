import { useCurrentFrame, useVideoConfig, interpolate, Audio, staticFile } from 'remotion';
import { Captions } from './Captions';
import type { CaptionWord } from './Captions';

// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint.
export type KafkaVsRabbitMQProps = {
  title: string;
  subtitle: string;
  audioFile: string;
  durationSeconds: number;
  // Times (seconds) from the voiceover. A beat that is not spoken is null and never triggers.
  beats: Record<string, number | null>;
  captions: CaptionWord[];
};

const ORDER_COUNT = 6;
const SEND_INTERVAL = 0.5; // seconds between orders leaving the order service
const ACK_INTERVAL = 0.5; // seconds between RabbitMQ acknowledging (and deleting) each order
const REPLAY_INTERVAL = 0.4; // seconds between Kafka replaying each old order

const KAFKA_COLOR = '#38bdf8';
const RABBIT_COLOR = '#c084fc';
const EMAIL_COLOR = '#34d399';
const ANALYTICS_COLOR = '#fbbf24';

// How many steps have happened by time t, given the step's start time
const stepsDone = (t: number, start: number | null, interval: number, max: number) =>
  start === null || t < start ? 0 : Math.min(max, Math.floor((t - start) / interval) + 1);

const fadeIn = (t: number, at: number | null, length = 0.5) =>
  at === null
    ? 0
    : interpolate(t, [at, at + length], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const Envelope = ({ number, color, bottom }: { number: number; color: string; bottom: number }) => (
  <div style={{
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom,
    width: '230px',
    height: '52px',
    borderRadius: '10px',
    border: `2px solid ${color}`,
    backgroundColor: '#0f172a',
    color,
    fontSize: '24px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 14px ${color}55`,
  }}>
    ✉ #{number}
  </div>
);

const Broker = ({
  left,
  name,
  rule,
  color,
  remaining,
}: {
  left: number;
  name: string;
  rule: string;
  color: string;
  remaining: number;
}) => (
  <>
    <div style={{ position: 'absolute', left, top: 500, width: '320px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '32px', fontWeight: 900 }}>{name}</div>
      <div style={{ color: '#94a3b8', fontSize: '20px', marginTop: '4px' }}>{rule}</div>
    </div>
    <div style={{
      position: 'absolute',
      left,
      top: 580,
      width: '320px',
      height: '560px',
      border: `3px solid ${color}`,
      borderRadius: '24px 24px 70px 70px',
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      overflow: 'hidden',
    }}>
      {Array.from({ length: remaining }, (_, index) => (
        <Envelope key={index} number={index + 1} color={color} bottom={20 + index * 66} />
      ))}
    </div>
  </>
);

const Consumer = ({ left, top, label, count, color, width = 320 }: {
  left: number;
  top: number;
  label: string;
  count: string;
  color: string;
  width?: number;
}) => (
  <div style={{
    position: 'absolute',
    left,
    top,
    width: `${width}px`,
    height: '130px',
    border: `2px solid ${color}`,
    borderRadius: '20px',
    backgroundColor: '#0f172a',
    textAlign: 'center',
    padding: '18px',
    boxSizing: 'border-box',
  }}>
    <div style={{ color, fontSize: '22px', fontWeight: 800 }}>{label}</div>
    <div style={{ color: '#ffffff', fontSize: '56px', fontWeight: 900, marginTop: '4px' }}>{count}</div>
  </div>
);

export const KafkaVsRabbitMQ = ({ title, subtitle, audioFile, beats, captions }: KafkaVsRabbitMQProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const sent = stepsDone(t, beats.orderSent, SEND_INTERVAL, ORDER_COUNT);
  const acked = Math.min(sent, stepsDone(t, beats.rabbitAck, ACK_INTERVAL, ORDER_COUNT));
  const rabbitRemaining = sent - acked;
  const replayed = Math.min(sent, stepsDone(t, beats.replay, REPLAY_INTERVAL, ORDER_COUNT));

  const analyticsOpacity = fadeIn(t, beats.newService) * (1 - fadeIn(t, beats.summary, 0.6));
  const summaryOpacity = fadeIn(t, beats.summary, 0.6);

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
      <div style={{ position: 'absolute', top: 100, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontSize: '84px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>{title}</div>
        <div style={{ color: '#94a3b8', fontSize: '28px', marginTop: '14px' }}>{subtitle}</div>
      </div>

      {/* Order service */}
      <div style={{
        position: 'absolute',
        top: 330,
        left: 360,
        width: '360px',
        height: '120px',
        border: '2px solid rgba(59, 130, 246, 0.8)',
        borderRadius: '20px',
        backgroundColor: '#0f172a',
        textAlign: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        boxShadow: '0 0 25px rgba(59, 130, 246, 0.25)',
      }}>
        <div style={{ color: '#60a5fa', fontSize: '28px', fontWeight: 800 }}>ORDER SERVICE</div>
        <div style={{ color: '#94a3b8', fontSize: '20px', marginTop: '6px' }}>same orders go to both</div>
      </div>

      <Broker left={120} name="KAFKA" rule="keeps every order for 7 days" color={KAFKA_COLOR} remaining={sent} />
      <Broker left={640} name="RABBITMQ" rule="deletes it after ACK" color={RABBIT_COLOR} remaining={rabbitRemaining} />

      {/* Email consumers */}
      <Consumer left={120} top={1170} label="EMAIL · KAFKA" count={String(sent)} color={EMAIL_COLOR} />
      <Consumer left={640} top={1170} label="EMAIL · RABBITMQ" count={String(acked)} color={EMAIL_COLOR} />

      {/* Analytics (joins later, replays old Kafka orders) */}
      <div style={{ opacity: analyticsOpacity, position: 'absolute', left: 120, top: 1340 }}>
        <Consumer left={0} top={0} label="ANALYTICS · REPLAYED" count={String(replayed)} color={ANALYTICS_COLOR} />
      </div>

      {/* Summary */}
      <div style={{
        position: 'absolute',
        left: 120,
        top: 1340,
        width: '840px',
        height: '150px',
        opacity: summaryOpacity,
        border: '2px solid #facc15',
        borderRadius: '20px',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: '34px', fontWeight: 900 }}>
          <span style={{ color: KAFKA_COLOR }}>KAFKA KEEPS {sent}</span>
          <span style={{ color: '#64748b' }}> · </span>
          <span style={{ color: RABBIT_COLOR }}>RABBITMQ KEEPS {rabbitRemaining}</span>
        </div>
        <div style={{ color: '#cbd5e1', fontSize: '22px', marginTop: '10px' }}>
          Replay ke liye: Kafka · Task queue ke liye: RabbitMQ
        </div>
      </div>

      <Captions captions={captions} t={t} />
    </div>
  );
};
