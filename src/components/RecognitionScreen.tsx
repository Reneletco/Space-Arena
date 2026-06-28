import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { detectShips } from '../recognition/colorDetector';
import { drawOverlay } from '../recognition/drawOverlay';
import type { DetectedShip } from '../types/ships';
import { SHIP_STATS } from '../types/ships';
import { SwordsIcon, RestartIcon } from './icons';

type Status = 'detecting' | 'done' | 'error';

export default function RecognitionScreen() {
  const navigate  = useNavigate();
  const rawImage  = useGameStore(s => s.rawImage);
  const setShips  = useGameStore(s => s.setShips);

  const canvasRef            = useRef<HTMLCanvasElement>(null);
  const [ships,   setLocal]  = useState<DetectedShip[]>([]);
  const [status,  setStatus] = useState<Status>('detecting');
  const [errMsg,  setErrMsg] = useState('');

  // Run detector once on mount
  useEffect(() => {
    if (!rawImage) { navigate('/'); return; }

    detectShips(rawImage)
      .then(found => {
        setLocal(found);
        setStatus('done');
        if (canvasRef.current) drawOverlay(canvasRef.current, rawImage, found);
      })
      .catch(e => {
        console.error(e);
        setStatus('error');
        setErrMsg('Ошибка при распознавании. Попробуйте переснять.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBattle = () => {
    setShips(ships);
    navigate('/edit');
  };

  const handleRetake = () => navigate('/');

  return (
    <div style={s.root}>
      <h2 style={s.title}>Распознавание</h2>

      {/* Canvas overlay */}
      <div style={s.canvasWrap}>
        <canvas ref={canvasRef} style={s.canvas} />
        {status === 'detecting' && (
          <div style={s.overlay}>
            <Spinner />
            <span style={{ marginTop: 10 }}>Распознаю корабли…</span>
          </div>
        )}
      </div>

      {/* Result list */}
      {status === 'done' && (
        <div style={s.list}>
          {ships.length === 0 ? (
            <p style={s.warn}>Корабли не найдены. Переснимите стол.</p>
          ) : (
            ships.map(ship => (
              <div key={ship.id} style={{ ...s.chip, borderColor: COLOR_HEX[ship.color] }}>
                <span style={{ color: COLOR_HEX[ship.color], fontWeight: 700 }}>
                  ■
                </span>
                &nbsp;{SHIP_STATS[ship.type].label}
                <span style={s.chipSub}>
                  &nbsp;·&nbsp;{ship.color}&nbsp;·&nbsp;{Math.round(ship.angle)}°
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {status === 'error' && <p style={s.warn}>{errMsg}</p>}

      {/* Buttons */}
      <div style={s.btnRow}>
        {status === 'done' && ships.length > 0 && (
          <button style={{ ...s.btn, background: 'linear-gradient(135deg,#22aa55,#44dd88)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            onClick={handleBattle}>
            <SwordsIcon size={18} /> В бой!
          </button>
        )}
        <button style={{ ...s.btn, background: '#333', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={handleRetake}>
          <RestartIcon /> Переснять
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  red: '#ff4444', blue: '#3399ff', green: '#33dd55', yellow: '#ffdd00',
};

function Spinner() {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      border: '4px solid #334', borderTopColor: '#8866ff',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}

// inject keyframe once
if (typeof document !== 'undefined' && !document.getElementById('sa-spin')) {
  const st = document.createElement('style');
  st.id = 'sa-spin';
  st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(st);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: 16, minHeight: '100dvh', boxSizing: 'border-box',
    background: '#0d0d1a', color: '#fff',
  },
  title: { margin: '0 0 14px', fontSize: 24, letterSpacing: 1 },
  canvasWrap: {
    position: 'relative', width: '100%', maxWidth: 640,
    borderRadius: 10, overflow: 'hidden', background: '#111',
    border: '2px solid #334', minHeight: 200,
  },
  canvas: { display: 'block', width: '100%', height: 'auto' },
  overlay: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#0d0d1acc', color: '#aaa', fontSize: 15,
  },
  list: {
    marginTop: 14, width: '100%', maxWidth: 640,
    display: 'flex', flexWrap: 'wrap', gap: 8,
  },
  chip: {
    padding: '6px 12px', borderRadius: 8, border: '2px solid',
    fontSize: 14, background: '#15152a',
  },
  chipSub: { color: '#888', fontSize: 12 },
  warn: { color: '#ff8888', marginTop: 12, textAlign: 'center' },
  btnRow: {
    marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
  },
  btn: {
    padding: '13px 32px', fontSize: 17, fontWeight: 700, borderRadius: 10,
    border: 'none', cursor: 'pointer', color: '#fff',
  },
};
