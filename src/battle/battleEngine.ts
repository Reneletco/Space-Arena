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

// ─── Линия огня ───────────────────────────────────────────────────────────────

/** Радиус попадания в нормализованных координатах (0..1 от размеров фото) */
const HIT_RADIUS = 0.06;

/**
 * Находит ближайший живой корабль на линии огня стрелка
 * (луч из носа стрелка в направлении его угла, до бесконечности).
 * Возвращает null, если на линии огня никого нет — это промах.
 */
export function findTarget(shooter: BattleShip, ships: BattleShip[]): BattleShip | null {
  const rad = (shooter.angle * Math.PI) / 180;
  const dx  = Math.cos(rad);
  const dy  = Math.sin(rad);

  let best: BattleShip | null = null;
  let bestDist = Infinity;

  for (const ship of ships) {
    if (!ship.alive || ship.id === shooter.id) continue;

    // Вектор от стрелка до потенциальной цели
    const ex = ship.x - shooter.x;
    const ey = ship.y - shooter.y;

    // Проекция на направление луча: если <= 0, цель позади стрелка
    const proj = ex * dx + ey * dy;
    if (proj <= 0) continue;

    // Перпендикулярное расстояние цели от линии луча
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp > HIT_RADIUS) continue;

    if (proj < bestDist) {
      bestDist = proj;
      best = ship;
    }
  }

  return best;
}

// ─── Щиты и урон ──────────────────────────────────────────────────────────────

export interface ResolvedShot {
  result: ShotResult;
  /** Какой щит заблокировал выстрел (если result === 'blocked') */
  shieldSide?: 'front' | 'rear' | 'left' | 'right';
}

/**
 * Применяет выстрел шутера по цели: определяет сторону попадания,
 * блокирует щитом (с отключением щита) либо наносит 1 урон.
 * При HP <= 0 корабль помечается уничтоженным. Мутирует target.
 */
export function resolveShot(shooter: BattleShip, target: BattleShip): ResolvedShot {
  const side = hitSide(shooter.angle, target.angle);

  if (target.shields[side]) {
    target.shields[side] = false;
    return { result: 'blocked', shieldSide: side };
  }

  target.hp -= 1;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
  return { result: 'hit' };
}

// ─── Главный цикл боя ──────────────────────────────────────────────────────────

export interface BattleResult {
  ships:  BattleShip[];
  events: ShotEvent[];
  /** Цвет победителя, либо null если бой закончился ничьей */
  winner: string | null;
}

/**
 * Прогоняет весь бой от начала до конца и возвращает итоговые корабли,
 * лог всех выстрелов (с снимками HP/alive после каждого хода) и победителя.
 */
export function simulateBattle(detected: DetectedShip[]): BattleResult {
  const ships = buildBattleShips(detected);
  const order = getFiringOrder(ships);
  const events: ShotEvent[] = [];

  for (const shooter of order) {
    if (!shooter.alive) continue;

    const target = findTarget(shooter, ships);
    let result: ShotResult = 'miss';
    let shieldSide: ShotEvent['shieldSide'];

    if (target) {
      const shot = resolveShot(shooter, target);
      result     = shot.result;
      shieldSide = shot.shieldSide;
    }

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

  const survivors    = ships.filter(s => s.alive);
  const survivorColors = [...new Set(survivors.map(s => s.color))];
  const winner = survivorColors.length === 1 ? survivorColors[0] : null;

  return { ships, events, winner };
}
