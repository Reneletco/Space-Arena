import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import type { BattleShip, ShotEvent } from '../types/battle';
import { SHIP_STATS } from '../types/ships';

const COLOR_HEX: Record<string, string> = {
  red: '#ff4444', blue: '#3399ff', green: '#33dd55', yellow: '#ffdd00',
};
const COLOR_RU: Record<string, string> = {
  red: 'Красный', blue: 'Синий', green: 'Зелёный', yellow: 'Жёлтый',
};
const SHIELD_RU: Record<string, string> = {
  front: 'нос', rear: 'корма', left: 'левый борт', right: 'правый борт',
};
const RESULT_ICON: Record<string, string> = {
  hit: '💥', blocked: '🛡️', miss: '〰️',
};

// ─── Силуэты корпусов кораблей ─────────────────────────────────────────────────

/**
 * Строит путь корпуса корабля в локальных координатах (нос направлен вдоль +X).
 * Каждый тип корабля имеет свой характерный силуэт.
 */
function shipHullPath(ctx: CanvasRenderingContext2D, type: string, R: number) {
  ctx.beginPath();
  switch (type) {
    case 'destroyer':
      // Вытянутый корпус с боковыми пилонами
      ctx.moveTo(R * 1.1, 0);
      ctx.lineTo(R * 0.25, R * 0.5);
      ctx.lineTo(-R * 0.45, R * 0.95);
      ctx.lineTo(-R * 0.85, R * 0.35);
      ctx.lineTo(-R * 0.65, 0);
      ctx.lineTo(-R * 0.85, -R * 0.35);
      ctx.lineTo(-R * 0.45, -R * 0.95);
      ctx.lineTo(R * 0.25, -R * 0.5);
      ctx.closePath();
      break;
    case 'interceptor':
      // Узкий быстрый дельтаплан
      ctx.moveTo(R * 1.35, 0);
      ctx.lineTo(-R * 0.25, R * 0.32);
      ctx.lineTo(-R * 0.05, 0);
      ctx.lineTo(-R * 0.25, -R * 0.32);
      ctx.closePath();
      break;
    case 'cruiser':
      // Массивный шестиугольный корпус с широкими бортами
      ctx.moveTo(R * 0.95, 0);
      ctx.lineTo(R * 0.45, R * 0.6);
      ctx.lineTo(-R * 0.35, R * 0.85);
      ctx.lineTo(-R * 1.0, R * 0.5);
      ctx.lineTo(-R * 1.0, -R * 0.5);
      ctx.lineTo(-R * 0.35, -R * 0.85);
      ctx.lineTo(R * 0.45, -R * 0.6);
      ctx.closePath();
      break;
    case 'scout':
    default:
      // Маленький лёгкий клин с тонкими крыльями
      ctx.moveTo(R * 1.25, 0);
      ctx.lineTo(-R * 0.45, R * 0.5);
      ctx.lineTo(-R * 0.15, 0);
      ctx.lineTo(-R * 0.45, -R * 0.5);
      ctx.closePath();
      break;
  }
}

/** Рисует деталь — кокпит у носа и двигатели у кормы — для всех типов кораблей. */
function drawShipDetails(ctx: CanvasRenderingContext2D, type: string, R: number, color: string) {
  // Кокпит
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.ellipse(R * 0.35, 0, R * 0.16, R * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Двигатели (1 для интерсептора/разведчика, 2 для разрушителя/крейсера)
  const engineY = type === 'interceptor' || type === 'scout' ? [0] : [R * 0.32, -R * 0.32];
  const rearX   = type === 'cruiser' ? -R * 0.95 : -R * 0.7;
  for (const ey of engineY) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.ellipse(rearX, ey, R * 0.14, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function drawArena(
  canvas: HTMLCanvasElement,
  ships: BattleShip[],
  event: ShotEvent | null,
  animPct: number,         // 0..1 прогресс анимации луча
) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  // Фон
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  // Звёзды (псевдорандом по canvas размеру)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 137 + 11) % W);
    const sy = ((i * 97  + 31) % H);
    ctx.fillRect(sx, sy, 1, 1);
  }

  // Найдём bounding box кораблей чтобы хорошо вписать в canvas
  if (!ships.length) return;
  const xs = ships.map(s => s.x);
  const ys = ships.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad  = 80;

  const scaleX = (maxX === minX) ? 1 : (W - pad * 2) / (maxX - minX);
  const scaleY = (maxY === minY) ? 1 : (H - pad * 2) / (maxY - minY);
  const scale  = Math.min(scaleX, scaleY, 3);

  const toCanvas = (x: number, y: number) => ({
    cx: (x - minX) * scale + pad + (W - pad * 2 - (maxX - minX) * scale) / 2,
    cy: (y - minY) * scale + pad + (H - pad * 2 - (maxY - minY) * scale) / 2,
  });

  // Лазерный луч
  if (event && event.result !== 'miss' && event.targetId && animPct > 0) {
    const shooter = ships.find(s => s.id === event.shooterId);
    const target  = ships.find(s => s.id === event.targetId);
    if (shooter && target) {
      const sp = toCanvas(shooter.x, shooter.y);
      const tp = toCanvas(target.x,  target.y);
      const ex = sp.cx + (tp.cx - sp.cx) * Math.min(animPct * 1.2, 1);
      const ey = sp.cy + (tp.cy - sp.cy) * Math.min(animPct * 1.2, 1);

      const color = COLOR_HEX[shooter.color];
      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 3;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(sp.cx, sp.cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Вспышка при попадании
      if (animPct > 0.85 && event.result === 'hit') {
        const flash = (animPct - 0.85) / 0.15;
        ctx.globalAlpha = flash;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(tp.cx, tp.cy, 18 * flash, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Промах — луч уходит в бесконечность
  if (event && event.result === 'miss' && animPct > 0) {
    const shooter = ships.find(s => s.id === event.shooterId);
    if (shooter) {
      const sp  = toCanvas(shooter.x, shooter.y);
      const rad = (shooter.angle * Math.PI) / 180;
      const len = Math.max(W, H) * animPct;
      const color = COLOR_HEX[shooter.color];
      ctx.save();
      ctx.shadowBlur  = 14;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.7 * (1 - animPct * 0.6);
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(sp.cx, sp.cy);
      ctx.lineTo(sp.cx + Math.cos(rad) * len, sp.cy + Math.sin(rad) * len);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Корабли
  const R = 22;
  for (const ship of ships) {
    const { cx, cy } = toCanvas(ship.x, ship.y);
    const color      = COLOR_HEX[ship.color];
    const isShooter  = event?.shooterId === ship.id;
    const isTarget   = event?.targetId  === ship.id;

    ctx.save();
    ctx.translate(cx, cy);

    // Подсветка активного корабля
    if (isShooter || isTarget) {
      ctx.shadowBlur  = 28;
      ctx.shadowColor = color;
    }

    // Корпус корабля — свой силуэт под каждый тип, с объёмным градиентом
    const rad = (ship.angle * Math.PI) / 180;
    ctx.rotate(rad);
    ctx.globalAlpha = ship.alive ? 1 : 0.35;

    const hullGradient = ctx.createLinearGradient(-R, 0, R, 0);
    if (ship.alive) {
      hullGradient.addColorStop(0, '#0a0a14');
      hullGradient.addColorStop(0.55, color);
      hullGradient.addColorStop(1, '#ffffff');
    } else {
      hullGradient.addColorStop(0, '#1a1a1a');
      hullGradient.addColorStop(1, '#3a3a3a');
    }

    shipHullPath(ctx, ship.type, R);
    ctx.fillStyle   = hullGradient;
    ctx.strokeStyle = ship.alive ? '#fff' : '#555';
    ctx.lineWidth   = isShooter ? 2.5 : 1.5;
    ctx.fill();
    ctx.stroke();

    if (ship.alive) drawShipDetails(ctx, ship.type, R, color);

    ctx.restore();

    // HP бар
    if (ship.alive) {
      const barW = R * 2.2;
      const barH = 5;
      const bx   = cx - barW / 2;
      const by   = cy + R + 6;
      ctx.fillStyle = '#222';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, barW * (ship.hp / ship.maxHp), barH);
    }

    // Метка
    ctx.fillStyle   = ship.alive ? '#fff' : '#666';
    ctx.globalAlpha = ship.alive ? 1 : 0.4;
    ctx.font        = 'bold 10px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(ship.label[0], cx, cy + R + 22); // первая буква типа

    // Щиты — маленькие точки вокруг корабля
    if (ship.alive) {
      const sideAngles = { front: ship.angle, rear: ship.angle + 180, left: ship.angle - 90, right: ship.angle + 90 };
      for (const [side, ang] of Object.entries(sideAngles)) {
        const active = ship.shields[side as keyof typeof ship.shields];
        const sr = (ang * Math.PI) / 180;
        const sx = cx + Math.cos(sr) * (R + 10);
        const sy = cy + Math.sin(sr) * (R + 10);
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#88ddff' : '#333';
        ctx.globalAlpha = 1;
        ctx.fill();
      }
    }
  }
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export default function ArenaScreen() {
  const navigate = useNavigate();
  const {
    battleShips, events, currentEventIdx, winner, isBattleReady,
    startBattle, nextEvent, prevEvent,
  } = useGameStore();

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [animPct, setAnimPct]     = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef    = useRef<number>(0);
  const playTimer  = useRef<ReturnType<typeof setTimeout>>();

  // Стартуем бой при маунте
  useEffect(() => {
    if (!isBattleReady) startBattle();
  }, []); // eslint-disable-line

  // Текущий корабль для каждого события
  const currentShips = (() => {
    if (!battleShips.length) return [];
    if (currentEventIdx < 0) return battleShips;

    // Применяем снимки состояния из события
    const ev = events[currentEventIdx];
    return battleShips.map(s => ({
      ...s,
      hp:    ev.hpSnapshot[s.id]    ?? s.hp,
      alive: ev.aliveSnapshot[s.id] ?? s.alive,
    }));
  })();

  // Перерисовка
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !battleShips.length) return;
    const ev = currentEventIdx >= 0 ? events[currentEventIdx] : null;
    drawArena(canvas, currentShips, ev, animPct);
  }, [currentShips, animPct, currentEventIdx]); // eslint-disable-line

  // Анимация луча
  const runAnim = (onDone: () => void) => {
    const start = performance.now();
    const dur   = 700; // ms
    const tick  = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setAnimPct(p);
      if (p < 1) animRef.current = requestAnimationFrame(tick);
      else onDone();
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const goNext = () => {
    cancelAnimationFrame(animRef.current);
    setAnimPct(0);
    nextEvent();
    runAnim(() => {});
  };

  const goPrev = () => {
    cancelAnimationFrame(animRef.current);
    setAnimPct(1);
    prevEvent();
  };

  // Авто-прокрутка
  useEffect(() => {
    if (!isPlaying) { clearTimeout(playTimer.current); return; }
    const step = () => {
      const { currentEventIdx: idx, events: evs } = useGameStore.getState();
      if (idx >= evs.length - 1) { setIsPlaying(false); return; }
      cancelAnimationFrame(animRef.current);
      setAnimPct(0);
      useGameStore.getState().nextEvent();
      runAnim(() => { playTimer.current = setTimeout(step, 500); });
    };
    playTimer.current = setTimeout(step, 300);
    return () => clearTimeout(playTimer.current);
  }, [isPlaying]); // eslint-disable-line

  // ── Текущее событие ──────────────────────────────────────────────────────
  const ev = currentEventIdx >= 0 ? events[currentEventIdx] : null;
  const shooter  = ev ? battleShips.find(s => s.id === ev.shooterId) : null;
  const target   = ev?.targetId ? battleShips.find(s => s.id === ev.targetId) : null;
  const isLast   = currentEventIdx >= events.length - 1;

  const eventText = (() => {
    if (!ev || !shooter) return null;
    const sName = `${COLOR_RU[shooter.color]} ${shooter.label}`;
    if (ev.result === 'miss')    return `${sName} — промах`;
    if (!target) return null;
    const tName = `${COLOR_RU[target.color]} ${target.label}`;
    if (ev.result === 'blocked') return `${sName} → ${tName}: щит (${SHIELD_RU[ev.shieldSide!]}) поглотил выстрел`;
    const hp = ev.hpSnapshot[target.id];
    if (hp <= 0) return `${sName} → ${tName}: УНИЧТОЖЕН 💀`;
    return `${sName} → ${tName}: попадание! HP ${hp + 1} → ${hp}`;
  })();

  const initiativePhase = currentEventIdx < 0;

  return (
    <div style={s.root}>
      <h2 style={s.title}>⚔️ Арена</h2>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={480} height={360}
        style={s.canvas}
      />

      {/* Фаза инициативы */}
      {initiativePhase && isBattleReady && (
        <div style={s.initiativeBox}>
          <p style={s.initTitle}>🎲 Инициатива</p>
          {[...battleShips]
            .sort((a, b) => b.initiative - a.initiative)
            .map(ship => (
              <div key={ship.id} style={s.initRow}>
                <span style={{ color: COLOR_HEX[ship.color], fontWeight: 700 }}>
                  {COLOR_RU[ship.color]} {ship.label}
                </span>
                <span style={s.initVal}>
                  d10({ship.initiative - SHIP_STATS[ship.type].initiativeBonus})
                  &nbsp;+{SHIP_STATS[ship.type].initiativeBonus}
                  &nbsp;= <b>{ship.initiative}</b>
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Текущее событие */}
      {ev && (
        <div style={{ ...s.eventBox, borderColor: shooter ? COLOR_HEX[shooter.color] : '#334' }}>
          <span style={s.eventIcon}>{RESULT_ICON[ev.result]}</span>
          <span style={s.eventText}>{eventText}</span>
          <span style={s.eventStep}>Ход {currentEventIdx + 1} / {events.length}</span>
        </div>
      )}

      {/* Конец боя */}
      {isLast && isBattleReady && (
        <div style={s.winnerBox}>
          {winner
            ? <p style={{ color: COLOR_HEX[winner] }}>🏆 Победитель: {COLOR_RU[winner]}!</p>
            : <p style={{ color: '#aaa' }}>🤝 Ничья!</p>
          }
          <button style={{ ...s.btn, background: '#334', marginTop: 8 }}
            onClick={() => { useGameStore.getState().reset(); navigate('/'); }}>
            🔄 Новый раунд
          </button>
        </div>
      )}

      {/* Управление */}
      <div style={s.controls}>
        <button style={s.btn} onClick={goPrev} disabled={currentEventIdx < 0}>◀</button>
        <button
          style={{ ...s.btn, background: isPlaying ? '#883' : 'linear-gradient(135deg,#6644ff,#aa44ff)', minWidth: 110 }}
          onClick={() => setIsPlaying(p => !p)}
          disabled={isLast}
        >
          {isPlaying ? '⏸ Пауза' : '▶ Авто'}
        </button>
        <button style={s.btn} onClick={goNext} disabled={isLast}>▶</button>
      </div>

      {/* Список кораблей */}
      <div style={s.shipList}>
        {battleShips.map(ship => {
          const hp = ev ? ev.hpSnapshot[ship.id] ?? ship.hp : ship.hp;
          const alive = ev ? ev.aliveSnapshot[ship.id] ?? ship.alive : ship.alive;
          return (
            <div key={ship.id} style={{
              ...s.shipChip,
              borderColor: COLOR_HEX[ship.color],
              opacity: alive ? 1 : 0.4,
            }}>
              <span style={{ color: COLOR_HEX[ship.color] }}>■</span>
              &nbsp;{COLOR_RU[ship.color]} {ship.label}
              <span style={s.hpText}> HP {hp}/{ship.maxHp}</span>
              {!alive && <span style={{ color: '#ff4444' }}> 💀</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Стили ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '12px 16px', minHeight: '100dvh', boxSizing: 'border-box',
    background: '#0d0d1a', color: '#fff',
  },
  title: { margin: '0 0 10px', fontSize: 22, letterSpacing: 1 },
  canvas: {
    width: '100%', maxWidth: 480, borderRadius: 12,
    border: '2px solid #223', display: 'block',
  },
  initiativeBox: {
    marginTop: 12, width: '100%', maxWidth: 480,
    background: '#12122a', borderRadius: 10, padding: '10px 14px',
    border: '1px solid #334',
  },
  initTitle: { margin: '0 0 6px', fontWeight: 700, color: '#aaa', fontSize: 13 },
  initRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '3px 0', fontSize: 14,
  },
  initVal: { color: '#ccc', fontSize: 13 },
  eventBox: {
    marginTop: 10, width: '100%', maxWidth: 480,
    background: '#12122a', borderRadius: 10,
    padding: '10px 14px', border: '2px solid',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  eventIcon: { fontSize: 22, flexShrink: 0 },
  eventText: { flex: 1, fontSize: 14, lineHeight: '1.4' },
  eventStep: { color: '#556', fontSize: 12, flexShrink: 0 },
  winnerBox: {
    marginTop: 10, textAlign: 'center', fontSize: 20, fontWeight: 700,
  },
  controls: {
    marginTop: 12, display: 'flex', gap: 10, alignItems: 'center',
  },
  btn: {
    padding: '10px 20px', fontSize: 15, fontWeight: 700,
    borderRadius: 9, border: 'none', cursor: 'pointer',
    background: '#223', color: '#fff',
    transition: 'opacity .15s',
  },
  shipList: {
    marginTop: 12, width: '100%', maxWidth: 480,
    display: 'flex', flexWrap: 'wrap', gap: 7,
  },
  shipChip: {
    padding: '5px 11px', borderRadius: 8, border: '2px solid',
    fontSize: 13, background: '#15152a', transition: 'opacity .3s',
  },
  hpText: { color: '#aaa', fontSize: 12 },
};
