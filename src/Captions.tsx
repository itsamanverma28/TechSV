export type CaptionWord = {
  text: string;
  start: number;
  end: number;
};

const CAPTION_WORDS_PER_LINE = 5;

// Shows the group of words around the one being spoken at time t (seconds), with the current word highlighted
export const Captions = ({ captions, t }: { captions: CaptionWord[]; t: number }) => {
  const spokenIndex = captions.findIndex((word) => t >= word.start && t < word.end);
  const activeIndex = spokenIndex === -1
    ? captions.filter((word) => word.start <= t).length - 1
    : spokenIndex;
  const lineStart = Math.floor(Math.max(activeIndex, 0) / CAPTION_WORDS_PER_LINE) * CAPTION_WORDS_PER_LINE;
  const captionLine = captions.slice(lineStart, lineStart + CAPTION_WORDS_PER_LINE);

  if (captionLine.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '480px', // above the bottom platform UI (420px) and inside the golden focus area
      left: '50px',
      right: '50px',
      textAlign: 'center',
      fontSize: '50px',
      fontWeight: 800,
      lineHeight: 1.3,
      textShadow: '0 4px 18px rgba(0, 0, 0, 0.9)',
      zIndex: 20,
    }}>
      {captionLine.map((word, index) => (
        <span
          key={lineStart + index}
          style={{ color: lineStart + index === activeIndex ? '#facc15' : '#ffffff', marginRight: '14px' }}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
};
