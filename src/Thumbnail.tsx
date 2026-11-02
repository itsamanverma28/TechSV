// Cover image for a video (rendered as a still, 1080x1920). A type alias so it satisfies Remotion's props constraint.
export type ThumbnailProps = {
  hook: string; // big line of text, usually the title or a short question
  subtitle?: string;
  emoji?: string;
  stat?: string; // big number or short label, e.g. "10,000 REQ"
  accent: string; // highlight colour for the hook and glow
};

export const Thumbnail = ({ hook, subtitle, emoji, stat, accent }: ThumbnailProps) => {
  // Shrink the hook so its longest word still fits the 1080px width
  const longestWord = Math.max(...hook.split(/\s+/).map((word) => word.length));
  const hookSize = Math.min(hook.length > 24 ? 124 : 176, Math.floor(900 / (longestWord * 0.62)));
  return (
    <div style={{
      width: '1080px',
      height: '1920px',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#05070c',
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, sans-serif',
      backgroundImage: `radial-gradient(circle at 50% 38%, ${accent}55, transparent 60%), radial-gradient(#1e293b 1px, transparent 1px)`,
      backgroundSize: '100% 100%, 36px 36px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 70px',
      boxSizing: 'border-box',
      textAlign: 'center',
    }}>
      {emoji && (
        <div style={{ fontSize: '300px', lineHeight: 1, filter: `drop-shadow(0 0 60px ${accent})` }}>{emoji}</div>
      )}

      <div style={{
        marginTop: emoji ? '40px' : 0,
        fontSize: `${hookSize}px`,
        fontWeight: 900,
        lineHeight: 1.05,
        textTransform: 'uppercase',
        color: accent,
        textShadow: `0 8px 0 #000, 0 0 50px ${accent}aa`,
        WebkitTextStroke: '3px #000',
      }}>
        {hook}
      </div>

      {stat && (
        <div style={{
          marginTop: '50px',
          padding: '18px 40px',
          borderRadius: '24px',
          border: `4px solid ${accent}`,
          backgroundColor: '#000000cc',
          fontSize: '96px',
          fontWeight: 900,
        }}>
          {stat}
        </div>
      )}

      {subtitle && (
        <div style={{ marginTop: '50px', fontSize: '40px', color: '#cbd5e1', fontWeight: 700 }}>{subtitle}</div>
      )}
    </div>
  );
};
