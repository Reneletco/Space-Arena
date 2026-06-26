/**
 * Battle engine — чистые функции, без React.
 *
 * Принимает DetectedShip[], возвращает:
 *  - начальный массив BattleShip[]
 *  - список ShotEvent[] (весь бой просчитан заранее)
 *  - winner: ShipColor | null
 */

import type { DetectedShip } from '../types/ships';
import { SHIP_STATS } from '../types/ships';
import type { BattleShip, ShotEvent, ShotResult } from '../types/battle';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const d10 = () => Math.floor(Math.random() * 10) + 1;

function angleDiff(a: number, b: number): number {
  let d = ((b - a) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d; // -180..180
}

/**
 * Определяет с какой стороны цели прилетает лазер.
 * laserAngle — направление луча (откуда летит, т.е. угол стрелка).
 * targetAngle — направление носа цели.
 */
function hitSide(
  laserAngle: number,
  targetAngle: number,
): 'front' | 'rear' | 'left' | 'right' {
  // Угол атаки относительно носа цели
  // Лазер летит ИЗ стрелка В цель, поэтому направление удара = laserAngle
  // Относительно носа цели: diff = laserAngle - targetAngle
  const diff = angleDiff(targetAngle, laserAngle); // -180..180
  const abs  = Math.abs(diff);
  if (abs <= 45)  return 'front';   // лазер летит в лоб
  if (abs >= 135) return 'rear';    // лазер бьёт в корму
  return diff > 0 ? 'right' : 'left';
}

/**
 * Находит ближайший корабль на линии огня (луч из носа стрелка).
 * Возвращает id цели или null.
 */
function findTarget(shooter: BattleShip, ships: BattleShip[]): BattleShip | null {
  const rad     = (shooter.angle * Math.PI) / 180;
  const dx      = Math.cos(rad);
  const dy      = Math.sin(rad);
  const HIT_R   = 0.06; // радиус попадания в нормализованных координатах

  let best: BattleShip | null = null;
  let bestDist = Infinity;

  for (const ship of ships) {
    if (!ship.alive || ship.id === shooter.id) continue;

    // Вектор от стрелка до цели
    const ex = ship.x - shooter.x;
    const ey = ship.y - shooter.y;

    // Проекция на направление луча
    const proj = ex * dx + ey * dy;
    if (proj <= 0) continue; // цель позади

    // Перпендикулярное расстояние до луча
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp > HIT_R) continue;

    if (proj < bestDist) {
      bestDist = proj;
      best = ship;
    }
  }

  return best;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildBattleShips(detected: DetectedShip[]): BattleShip[] {
  return detected.map(d => {
    const stats = SHIP_STATS[d.type];
    const roll  = d10();
    return {
      id:         d.id,
      color:      d.color,
      type:       d.type,
      label:      stats.label,
      x:          d.cx,
      y:          d.cy,
      angle:      d.angle,
      hp:         stats.hp,
      maxHp:      stats.hp,
      initiative: roll + stats.initiativeBonus,
      shields:    { front: true, rear: true, left: true, right: true },
      alive:      true,
    };
  });
}

export interface BattleResult {
  ships:  BattleShip[];
  events: ShotEvent[];
  winner: string | null; // ShipColor или null
}

export function simulateBattle(initialShips: DetectedShip[]): BattleResult {
  const ships = buildBattleShips(initialShips);

  // Порядок стрельбы: убывание инициативы
  const order = [...ships].sort((a, b) => b.initiative - a.initiative);

  const events: ShotEvent[] = [];

  for (const shooter of order) {
    if (!shooter.alive) continue;

    const target = findTarget(shooter, ships);

    let result: ShotResult = 'miss';
    let shieldSide: ShotEvent['shieldSide'];

    if (target) {
      const side = hitSide(shooter.angle, target.angle);
      if (target.shields[side]) {
        // Щит поглощает
        target.shields[side] = false;
        result     = 'blocked';
        shieldSide = side;
      } else {
        // Урон
        target.hp -= 1;
        if (target.hp <= 0) {
          target.hp    = 0;
          target.alive = false;
        }
        result = 'hit';
      }
    }

    // Снимок состояния
    const hpSnapshot:    Record<string, number>  = {};
    const aliveSnapshot: Record<string, boolean> = {};
    for (const s of ships) {
      hpSnapshot[s.id]    = s.hp;
      aliveSnapshot[s.id] = s.alive;
    }

    events.push({
      shooterId:      shooter.id,
      targetId:       target?.id ?? null,
      result,
      shieldSide,
      hpSnapshot,
      aliveSnapshot,
      initiativeRoll: shooter.initiative,
    });
  }

  // Победитель
  const alive = ships.filter(s => s.alive);
  const colors = [...new Set(alive.map(s => s.color))];
  const winner = colors.length === 1 ? colors[0] : null;

  return { ships, events, winner };
}
