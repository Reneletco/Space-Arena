import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import type { DetectedShip, ShipColor, ShipType } from '../types/ships';
import { SHIP_STATS } from '../types/ships';
import { SwordsIcon, ChevronLeftIcon, PlusIcon, TrashIcon } from './icons';

const COLOR_HEX: Record<string, string> = {
  red: '#ff4444', blue: '#3399ff', green: '#33dd55', yellow: '#ffdd00',
};

const ALL_COLORS: ShipColor[] = ['red', 'blue', 'green', 'yellow'];
const ALL_TYPES:  ShipType[]  = ['destroyer', 'interceptor', 'cruiser', 'scout'];
let nextShipSeq = 1;

type DragMode = 'move' | 'rotate';
interface DragState { id: string; mode: DragMode; offsetX: number; offsetY: number }

// Рисуем фото стола, а поверх — рамки кораблей, стрелку носа и ручку поворота.
// Выбранный корабль обводим потолще.
function drawEditOverlay(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  ships: DetectedShip[],
  selectedId: string | null,
) {
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  for (const ship of ships) {
    const hex = COLOR_HEX[ship.color] ?? '#ffffff';
    const { x, y, w, h } = ship.bbox;
    const isSelected = ship.id === selectedId;

    ctx.strokeStyle = hex;
    ctx.lineWidth   = isSelected ? Math.max(4, w * 0.05) : Math.max(2, w * 0.03);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = hex + (isSelected ? '33' : '22');
    ctx.fillRect(x, y, w, h);

    const label = `${SHIP_STATS[ship.type].label} (${ship.color})`;
    ctx.font = `bold ${Math.max(12, h * 0.15)}px sans-serif`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = hex + 'cc';
    ctx.fillRect(x, y - Math.max(18, h * 0.18), tw + 8, Math.max(18, h * 0.18));
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 4, y - 4);

    // стрелка носа, а на её кончике — ручка, за которую крутим
    const cx  = x + w / 2;
    const cy  = y + h / 2;
    const len = Math.min(w, h) * 0.55;
    const rad = (ship.angle * Math.PI) / 180;
    const ex  = cx + Math.cos(rad) * len;
    const ey  = cy + Math.sin(rad) * len;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = hex;
    ctx.lineWidth   = Math.max(2, len * 0.08);
    ctx.stroke();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(10, len * 0.22), 0, Math.PI * 2);
      ctx.fillStyle   = '#fff';
      ctx.strokeStyle = hex;
      ctx.lineWidth   = 3;
      ctx.fill();
      ctx.stroke();
    }
  }
}

export default function EditScreen() {
  const navigate = useNavigate();
  const rawImage = useGameStore(s => s.rawImage);
  const detected = useGameStore(s => s.detectedShips);
  const setShips = useGameStore(s => s.setShips);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const dragRef   = useRef<DragState | null>(null);

  const [ships, setLocalShips]   = useState<DetectedShip[]>(detected);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [imgReady, setImgReady]  = useState(false);
  const [addOpen, setAddOpen]     = useState(false);
  const [newType, setNewType]     = useState<ShipType>('destroyer');
  const [newColor, setNewColor]   = useState<ShipColor>('red');

  // грузим фото один раз при заходе; нет фото — уходим на старт
  useEffect(() => {
    if (!rawImage) { navigate('/'); return; }
    setLocalShips(detected);
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgReady(true); };
    img.src = rawImage;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // перерисовываем, как только что-то поменяли или выбрали другой корабль
  useEffect(() => {
    if (!imgReady || !canvasRef.current || !imgRef.current) return;
    drawEditOverlay(canvasRef.current, imgRef.current, ships, selectedId);
  }, [ships, selectedId, imgReady]);

  const toImageCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = toImageCoords(e);

    // сперва смотрим, не попали ли по ручке поворота выбранного корабля
    const selected = ships.find(sh => sh.id === selectedId);
    if (selected) {
      const cx  = selected.bbox.x + selected.bbox.w / 2;
      const cy  = selected.bbox.y + selected.bbox.h / 2;
      const len = Math.min(selected.bbox.w, selected.bbox.h) * 0.55;
      const rad = (selected.angle * Math.PI) / 180;
      const hx  = cx + Math.cos(rad) * len;
      const hy  = cy + Math.sin(rad) * len;
      if (Math.hypot(x - hx, y - hy) < Math.max(16, len * 0.3)) {
        dragRef.current = { id: selected.id, mode: 'rotate', offsetX: 0, offsetY: 0 };
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
    }

    // иначе ищем корабль под пальцем — сверху вниз, чтобы взять верхний
    for (let i = ships.length - 1; i >= 0; i--) {
      const ship = ships[i];
      const { x: bx, y: by, w, h } = ship.bbox;
      if (x >= bx && x <= bx + w && y >= by && y <= by + h) {
        setSelected(ship.id);
        dragRef.current = {
          id: ship.id, mode: 'move',
          offsetX: x - (bx + w / 2), offsetY: y - (by + h / 2),
        };
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
    }

    setSelected(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = toImageCoords(e);

    setLocalShips(prev => prev.map(ship => {
      if (ship.id !== drag.id) return ship;
      if (drag.mode === 'move') {
        const newCx = x - drag.offsetX;
        const newCy = y - drag.offsetY;
        return {
          ...ship,
          cx: newCx, cy: newCy,
          bbox: { ...ship.bbox, x: newCx - ship.bbox.w / 2, y: newCy - ship.bbox.h / 2 },
        };
      }
      const cx = ship.bbox.x + ship.bbox.w / 2;
      const cy = ship.bbox.y + ship.bbox.h / 2;
      const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
      return { ...ship, angle };
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleConfirm = () => {
    setShips(ships);
    navigate('/arena');
  };

  const handleAddShip = () => {
    const img = imgRef.current;
    const W = img?.naturalWidth  ?? 800;
    const H = img?.naturalHeight ?? 600;
    const size = Math.min(W, H) * 0.15;
    const cx = W / 2;
    const cy = H / 2;
    const id = `new-${nextShipSeq++}`;

    const ship: DetectedShip = {
      id, color: newColor, type: newType,
      cx, cy, angle: 0,
      bbox: { x: cx - size / 2, y: cy - size / 2, w: size, h: size },
    };
    setLocalShips(prev => [...prev, ship]);
    setSelected(id);
    setAddOpen(false);
  };

  const handleRemoveShip = (id: string) => {
    setLocalShips(prev => prev.filter(sh => sh.id !== id));
    if (selectedId === id) setSelected(null);
  };

  // ── меню правки выбранного корабля ──────────────────────────────────────
  const selectedShip = ships.find(sh => sh.id === selectedId) ?? null;
  const displayAngle = selectedShip
    ? Math.round(((selectedShip.angle % 360) + 360) % 360)
    : 0;

  const updateSelected = (patch: Partial<DetectedShip>) => {
    if (!selectedId) return;
    setLocalShips(prev => prev.map(sh => (sh.id === selectedId ? { ...sh, ...patch } : sh)));
  };
  const setAngle = (deg: number) => updateSelected({ angle: ((deg % 360) + 360) % 360 });
  const rotateBy = (delta: number) => {
    if (selectedShip) setAngle(selectedShip.angle + delta);
  };

  const DIRECTIONS = [
    { deg: 270, label: '↑' },
    { deg: 0,   label: '→' },
    { deg: 90,  label: '↓' },
    { deg: 180, label: '←' },
  ];

  return (
    <div style={s.root}>
      <h2 style={s.title}>Расстановка кораблей</h2>
      <p style={s.hint}>Перетащите корабль — позиция; крутите ползунок или тяните белую ручку — поворот. Нажмите на корабль, чтобы открыть меню правки.</p>

      <div style={s.canvasWrap}>
        <canvas
          ref={canvasRef}
          style={s.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      {selectedShip && (
        <div style={s.inspector}>
          <div style={s.inspectorHead}>
            <span style={{ color: COLOR_HEX[selectedShip.color], fontSize: 18 }}>■</span>
            <span style={s.inspectorTitle}>{SHIP_STATS[selectedShip.type].label}</span>
            <button
              style={s.inspectorDel}
              onClick={() => handleRemoveShip(selectedShip.id)}
              title="Удалить корабль"
            >
              <TrashIcon size={16} />
            </button>
          </div>

          {/* Угол поворота */}
          <div style={s.row}>
            <span style={s.rowLabel}>Угол</span>
            <button style={s.rotBtn} onClick={() => rotateBy(-45)} title="−45°">⟲ 45</button>
            <button style={s.rotBtn} onClick={() => rotateBy(-15)} title="−15°">−15</button>
            <input
              type="range" min={0} max={359} value={displayAngle}
              onChange={e => setAngle(Number(e.target.value))}
              style={s.slider}
            />
            <button style={s.rotBtn} onClick={() => rotateBy(15)} title="+15°">+15</button>
            <button style={s.rotBtn} onClick={() => rotateBy(45)} title="+45°">45 ⟳</button>
            <input
              type="number" value={displayAngle}
              onChange={e => { const v = Number(e.target.value); if (!Number.isNaN(v)) setAngle(v); }}
              style={s.angleField}
            />
            <span style={s.deg}>°</span>
          </div>

          {/* Быстрые направления */}
          <div style={s.row}>
            <span style={s.rowLabel}>Направление</span>
            {DIRECTIONS.map(d => (
              <button
                key={d.deg}
                style={{ ...s.pill, ...(displayAngle === d.deg ? s.pillActive : {}) }}
                onClick={() => setAngle(d.deg)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Тип */}
          <div style={s.row}>
            <span style={s.rowLabel}>Тип</span>
            {ALL_TYPES.map(t => (
              <button
                key={t}
                style={{ ...s.pill, ...(selectedShip.type === t ? s.pillActive : {}) }}
                onClick={() => updateSelected({ type: t })}
              >
                {SHIP_STATS[t].label}
              </button>
            ))}
          </div>

          {/* Цвет */}
          <div style={s.row}>
            <span style={s.rowLabel}>Цвет</span>
            {ALL_COLORS.map(c => (
              <button
                key={c}
                style={{
                  ...s.colorDot, background: COLOR_HEX[c],
                  outline: selectedShip.color === c ? '2px solid #fff' : 'none',
                }}
                onClick={() => updateSelected({ color: c })}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      <div style={s.list}>
        {ships.map(ship => (
          <div
            key={ship.id}
            style={{
              ...s.chip, borderColor: COLOR_HEX[ship.color],
              background: ship.id === selectedId ? '#23234a' : '#15152a',
            }}
            onClick={() => setSelected(ship.id)}
          >
            <span style={{ color: COLOR_HEX[ship.color], fontWeight: 700 }}>■</span>
            &nbsp;{SHIP_STATS[ship.type].label}
            <span style={s.chipSub}>&nbsp;·&nbsp;{ship.color}&nbsp;·&nbsp;{Math.round(ship.angle)}°</span>
            <button
              style={s.chipDelete}
              onClick={e => { e.stopPropagation(); handleRemoveShip(ship.id); }}
              title="Удалить корабль"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        ))}

        <button style={s.addChip} onClick={() => setAddOpen(v => !v)}>
          <PlusIcon size={16} /> Добавить корабль
        </button>
      </div>

      {addOpen && (
        <div style={s.addPanel}>
          <div style={s.addRow}>
            <span style={s.addLabel}>Тип:</span>
            {ALL_TYPES.map(t => (
              <button
                key={t}
                style={{ ...s.pill, ...(newType === t ? s.pillActive : {}) }}
                onClick={() => setNewType(t)}
              >
                {SHIP_STATS[t].label}
              </button>
            ))}
          </div>
          <div style={s.addRow}>
            <span style={s.addLabel}>Цвет:</span>
            {ALL_COLORS.map(c => (
              <button
                key={c}
                style={{
                  ...s.colorDot, background: COLOR_HEX[c],
                  outline: newColor === c ? '2px solid #fff' : 'none',
                }}
                onClick={() => setNewColor(c)}
                title={c}
              />
            ))}
          </div>
          <button style={{ ...s.btn, background: 'linear-gradient(135deg,#6644ff,#aa44ff)', marginTop: 4 }} onClick={handleAddShip}>
            <PlusIcon size={16} /> Добавить
          </button>
        </div>
      )}

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
  hint: { margin: '0 0 14px', color: '#888', fontSize: 13, textAlign: 'center', maxWidth: 480 },
  canvasWrap: {
    position: 'relative', width: '100%', maxWidth: 640,
    borderRadius: 10, overflow: 'hidden', background: '#111',
    border: '2px solid #334', minHeight: 200,
  },
  canvas: { display: 'block', width: '100%', height: 'auto', touchAction: 'none', cursor: 'grab' },
  list: {
    marginTop: 14, width: '100%', maxWidth: 640,
    display: 'flex', flexWrap: 'wrap', gap: 8,
  },
  chip: {
    padding: '6px 12px', borderRadius: 8, border: '2px solid',
    fontSize: 14, background: '#15152a', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  chipSub: { color: '#888', fontSize: 12 },
  chipDelete: {
    border: 'none', background: 'transparent', color: '#aaa', cursor: 'pointer',
    padding: 2, display: 'inline-flex', marginLeft: 2,
  },
  addChip: {
    padding: '6px 14px', borderRadius: 8, border: '2px dashed #445',
    fontSize: 14, background: 'transparent', color: '#aaa', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  addPanel: {
    marginTop: 12, width: '100%', maxWidth: 640,
    background: '#15152a', borderRadius: 10, padding: 14,
    border: '1px solid #334', display: 'flex', flexDirection: 'column', gap: 10,
  },
  inspector: {
    marginTop: 12, width: '100%', maxWidth: 640,
    background: '#15152a', borderRadius: 10, padding: 14,
    border: '1px solid #334', display: 'flex', flexDirection: 'column', gap: 10,
  },
  inspectorHead: { display: 'flex', alignItems: 'center', gap: 8 },
  inspectorTitle: { fontSize: 16, fontWeight: 700, flex: 1 },
  inspectorDel: {
    border: 'none', background: 'transparent', color: '#e66', cursor: 'pointer',
    display: 'inline-flex', padding: 4,
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowLabel: { color: '#888', fontSize: 13, minWidth: 84 },
  slider: { flex: 1, minWidth: 120, accentColor: '#6644ff' },
  rotBtn: {
    padding: '4px 9px', borderRadius: 6, border: '1px solid #445',
    background: 'transparent', color: '#ccc', fontSize: 12, cursor: 'pointer',
  },
  angleField: {
    width: 58, padding: '5px 6px', borderRadius: 6, border: '1px solid #445',
    background: '#0d0d1a', color: '#fff', fontSize: 13,
  },
  deg: { color: '#888' },
  addRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  addLabel: { color: '#888', fontSize: 13, minWidth: 40 },
  pill: {
    padding: '5px 12px', borderRadius: 16, border: '1px solid #445',
    background: 'transparent', color: '#ccc', fontSize: 13, cursor: 'pointer',
  },
  pillActive: { background: '#6644ff', borderColor: '#6644ff', color: '#fff' },
  colorDot: {
    width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
  },
  btnRow: {
    marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
  },
  btn: {
    padding: '13px 32px', fontSize: 17, fontWeight: 700, borderRadius: 10,
    border: 'none', cursor: 'pointer', color: '#fff',
    display: 'inline-flex', alignItems: 'center', gap: 8,
  },
};
