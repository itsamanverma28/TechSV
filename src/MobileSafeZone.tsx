// Preview-only overlay that marks the platform UI areas (Reels / Shorts). Never shown in rendered videos.
// Keep the main visuals and captions inside the golden window: y 260 to 1460.
export const MobileSafeZone = ({ show = true }: { show?: boolean }) => {
  if (!show) {
    return null;
  }
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '220px',
        background: 'rgba(239, 68, 68, 0.25)',
        borderBottom: '2px dashed red',
      }}>
        <span style={{ color: 'white', padding: '10px', fontSize: '20px' }}>⚠️ Top UI Zone (Keep Clear)</span>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '420px',
        background: 'rgba(239, 68, 68, 0.25)',
        borderTop: '2px dashed red',
      }}>
        <span style={{ color: 'white', padding: '10px', fontSize: '20px' }}>⚠️ Bottom Captions / User Info Zone</span>
      </div>
      <div style={{
        position: 'absolute',
        top: '220px',
        bottom: '420px',
        right: 0,
        width: '140px',
        background: 'rgba(245, 158, 11, 0.2)',
        borderLeft: '2px dashed orange',
      }}>
        <span style={{ color: 'white', padding: '10px', fontSize: '18px', display: 'block', transform: 'rotate(90deg)' }}>
          Icons
        </span>
      </div>
      <div style={{
        position: 'absolute',
        top: '260px',
        height: '1200px',
        left: 0,
        right: '140px',
        border: '2px dashed #22c55e',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#4ade80', padding: '8px', fontSize: '18px', display: 'block' }}>Golden Focus Area (y 260–1460)</span>
      </div>
    </div>
  );
};
