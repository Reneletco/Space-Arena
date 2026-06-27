import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { drawOverlay } from '../recognition/drawOverlay';
import type { DetectedShip } from '../types/ships';
import { SHIP_STATS } from '../types/ships';
import { SwordsIcon, ChevronLeftIcon } from './icons';

const COLOR_HEX: Record<string, string> = {
  red: '#ff4444', blue: '#3399ff', green: '#33dd55', yellow: '#ffdd00',
};

export default function EditScreen() {
  const navigate    = useNavigate();
  const rawImage    = useGameStore(s => s.rawImage);
  const detected    = useGameStore(s => s.detectedShips);
  const setShips    = useGameStore(s => s.setShips);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ships, setLocalShips] = useState<DetectedShip[]>(detected);

  useEffect(() => {
    if (!rawImage) { navigate('/'); return; }
    setLocalShips(detected);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Перерисовка наложения при любом изменении расстановки
  useEffect(() => {
    if (!rawImage || !canvasRef.current) return;
    drawOverlay(canvasRef.current, rawImage, ships);
  }, [rawImage, ships]);

  const handleConfirm = () => {
    setShips(ships);
    navigate('/arena');
  };

  return (
    <div style={s.root}>
      <h2 style={s.title}>Расстановка кораблей</h2>
      <p style={s.hint}>Проверьте и поправьте позиции перед боем</p>

      <div style={s.canvasWrap}>
        <canvas ref={canvasRef} style={s.canvas} />
      </div>

      <div style={s.list}>
        {ships.map(ship => (
          <div key={ship.id} style={{ ...s.chip, borderColor: COLOR_HEX[ship.color] }}>
            <span style={{ color: COLOR_HEX[ship.color], fontWeight: 700 }}>■</span>
            &nbsp;{SHIP_STATS[ship.type].label}
            <span style={s.chipSub}>&nbsp;·&nbsp;{ship.color}&nbsp;·&nbsp;{Math.round(ship.angle)}°</span>
          </div>
        ))}
      </div>

      <div style={s.btnRow}>
        <button style={{ ...s.btn, background: 'linear-gradient(135deg,#22aa55,#44dd88)' }} onClick={handleConfirm}>
          <SwordsIcon size={18} /> В бой!
        </button>
        <button style={{ ...s.btn, background: '#333' }} onClick={() => navigate('/recognition')}>
          <ChevronLeftIcon /> Назад
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: 16, minHeight: '100dvh', boxSizing: 'border-box',
    background: '#0d0d1a', color: '#fff',
  },
  title: { margin: '0 0 4px', fontSize: 22, letterSpacing: 1 },
  hint: { margin: '0 0 14px', color: '#888', fontSize: 14 },
  canvasWrap: {
    position: 'relative', width: '100%', maxWidth: 640,
    borderRadius: 10, overflow: 'hidden', background: '#111',
    border: '2px solid #334', minHeight: 200,
  },
  canvas: { display: 'block', width: '100%', height: 'auto' },
  list: {
    marginTop: 14, width: '100%', maxWidth: 640,
    display: 'flex', flexWrap: 'wrap', gap: 8,
  },
  chip: {
    padding: '6px 12px', borderRadius: 8, border: '2px solid',
    fontSize: 14, background: '#15152a',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  chipSub: { color: '#888', fontSize: 12 },
  btnRow: {
    marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
  },
  btn: {
    padding: '13px 32px', fontSize: 17, fontWeight: 700, borderRadius: 10,
    border: 'none', cursor: 'pointer', color: '#fff',
    display: 'inline-flex', alignItems: 'center', gap: 8,
  },
};
