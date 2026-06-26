import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useGameStore } from '../store/gameStore';

type Mode = 'choose' | 'camera';

export default function CameraScreen() {
  const navigate = useNavigate();
  const setImage = useGameStore(s => s.setImage);
  const [mode, setMode] = useState<Mode>('choose');

  const { videoRef, error, isCameraReady, capture, stopCamera, startCamera } = useCamera();

  // Не запускаем камеру автоматически — только если выбрали режим камеры
  const hasStarted = useRef(false);
  useEffect(() => {
    if (mode === 'camera' && !hasStarted.current) {
      hasStarted.current = true;
      startCamera();
    }
    if (mode !== 'camera') {
      stopCamera();
      hasStarted.current = false;
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // autoplay после loadedmetadata
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => video.play().catch(() => {});
    video.addEventListener('loadedmetadata', onMeta);
    return () => video.removeEventListener('loadedmetadata', onMeta);
  }, [videoRef]);

  // Снимок с камеры
  const handleCapture = () => {
    const dataUrl = capture();
    if (!dataUrl) return;
    setImage(dataUrl);
    stopCamera();
    navigate('/recognition');
  };

  // Загрузка файла
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      navigate('/recognition');
    };
    reader.readAsDataURL(file);
  };

  // ── Экран выбора ──────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div style={s.root}>
        <h1 style={s.title}>Space Arena</h1>
        <p style={s.subtitle}>Как хотите добавить фото стола?</p>

        <div style={s.cards}>
          {/* Загрузить файл */}
          <label style={s.card}>
            <span style={s.cardIcon}>🖼️</span>
            <span style={s.cardLabel}>Загрузить фото</span>
            <span style={s.cardSub}>Выбрать из галереи или файлов</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>

          {/* Камера */}
          <button style={s.card} onClick={() => setMode('camera')}>
            <span style={s.cardIcon}>📷</span>
            <span style={s.cardLabel}>Сделать снимок</span>
            <span style={s.cardSub}>Использовать камеру устройства</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Экран камеры ─────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <h1 style={s.title}>Space Arena</h1>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.viewfinder}>
        <video ref={videoRef} autoPlay playsInline muted style={s.video} />
        {!isCameraReady && !error && (
          <div style={s.loader}>Подключение камеры…</div>
        )}
      </div>

      <div style={s.btnRow}>
        <button
          onClick={handleCapture}
          disabled={!isCameraReady}
          style={{ ...s.btn, opacity: isCameraReady ? 1 : 0.45 }}
        >
          📸 Сделать фото
        </button>
        <button
          onClick={() => setMode('choose')}
          style={{ ...s.btn, background: '#333' }}
        >
          ← Назад
        </button>
      </div>
    </div>
  );
}

// ── Стили ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 16px', minHeight: '100dvh', boxSizing: 'border-box',
    background: '#0d0d1a', color: '#fff',
  },
  title: { margin: '0 0 8px', fontSize: 28, letterSpacing: 2 },
  subtitle: { margin: '0 0 32px', color: '#888', fontSize: 15 },
  cards: {
    display: 'flex', flexDirection: 'column', gap: 16,
    width: '100%', maxWidth: 400,
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '28px 20px', borderRadius: 14, cursor: 'pointer',
    background: '#15152a', border: '2px solid #2a2a4a',
    color: '#fff', textAlign: 'center',
    transition: 'border-color .2s, background .2s',
  } as React.CSSProperties,
  cardIcon: { fontSize: 40, marginBottom: 10 },
  cardLabel: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#888' },
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
  btnRow: { marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  btn: {
    padding: '14px 32px', fontSize: 17, fontWeight: 700,
    borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg,#6644ff,#aa44ff)',
    color: '#fff', transition: 'opacity .2s',
  },
};
