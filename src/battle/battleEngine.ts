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
import type { BattleShip } from '../types/battle';

// ─── Хелперы ──────────────────────────────────────────────────────────────────

/** Бросок d10: случайное целое число от 1 до 10 */
export function rollD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}

/** Кратчайшая разница углов b - a в диапазоне -180..180 */
function angleDiff(a: number, b: number): number {
  let diff = ((b - a) % 360 + 360) % 360;
  if (diff > 180) diff -= 360;
  return diff;
}

/**
 * Определяет, с какой стороны цели прилетает лазер.
 * laserAngle  — направление полёта луча (= угол носа стрелка)
 * targetAngle — направление носа цели
 */
export function hitSide(
  laserAngle: number,
  targetAngle: number,
): 'front' | 'rear' | 'left' | 'right' {
  const diff = angleDiff(targetAngle, laserAngle);
  const abs  = Math.abs(diff);
  if (abs <= 45)  return 'front';
  if (abs >= 135) return 'rear';
  return diff > 0 ? 'right' : 'left';
}

// ─── Инициатива ───────────────────────────────────────────────────────────────

/**
 * Строит боевые корабли из распознанных: каждому бросается d10 + бонус
 * инициативы его типа, выставляются стартовые HP и активные щиты на все стороны.
 */
export function buildBattleShips(detected: DetectedShip[]): BattleShip[] {
  return detected.map(d => {
    const stats = SHIP_STATS[d.type];
    const roll  = rollD10();
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

/** Порядок стрельбы: по убыванию итоговой инициативы */
export function getFiringOrder(ships: BattleShip[]): BattleShip[] {
  return [...ships].sort((a, b) => b.initiative - a.initiative);
}
