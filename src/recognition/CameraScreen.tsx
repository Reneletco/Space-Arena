import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useGameStore } from '../store/gameStore';

export default function CameraScreen() {
  const navigate   = useNavigate();
  const setImage   = useGameStore(s => s.setImage);
  const { videoRef, error, isCameraReady, capture, stopCamera } = useCamera();

  // Ensure video plays when stream is attached
  const hasAutoPlayed = useRef(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoad = () => {
      if (!hasAutoPlayed.current) {
        video.play().catch(() => {});
        hasAutoPlayed.current = true;
      }
    };
    video.addEventListener('loadedmetadata', onLoad);
    return () => video.removeEventListener('loadedmetadata', onLoad);
  }, [videoRef]);

  const handleCapture = () => {
    const dataUrl = capture();
    if (!dataUrl) return;
    setImage(dataUrl);
    stopCamera();
    navigate('/recognition');
  };

  return (
    <div style={styles.root}>
      <h1 style={styles.title}>Space Arena</h1>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.viewfinder}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={styles.video}
        />
        {!isCameraReady && !error && (
          <div style={styles.loader}>Подключение камеры…</div>
        )}
      </div>

      <button
        onClick={handleCapture}
        disabled={!isCameraReady}
        style={{ ...styles.btn, opacity: isCameraReady ? 1 : 0.45 }}
      >
        📸 Сделать фото
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '16px', minHeight: '100dvh', boxSizing: 'border-box',
    background: '#0d0d1a', color: '#fff',
  },
  title: { margin: '0 0 16px', fontSize: 28, letterSpacing: 2 },
  error: { color: '#ff6666', marginBottom: 12 },
  viewfinder: {
    position: 'relative', width: '100%', maxWidth: 640,
    aspectRatio: '4/3', background: '#111', borderRadius: 12, overflow: 'hidden',
    border: '2px solid #334',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  loader: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    color: '#888', fontSize: 16,
  },
  btn: {
    marginTop: 20, padding: '14px 40px', fontSize: 18, fontWeight: 700,
    borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg,#6644ff,#aa44ff)',
    color: '#fff', transition: 'opacity .2s',
  },
};
