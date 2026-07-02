/**
 * Battle engine — чистые функции, без React.
 *
 * Принимает DetectedShip[], возвращает:
 *  - начальный массив BattleShip[]
 *  - список ShotEvent[] (весь бой просчитан заранее)
 *  - winner: ShipColor | null
 *
 * Правила боя:
 *  - Цвет корабля = команда. Одноцветные корабли — союзники и НЕ стреляют
 *    друг в друга.
 *  - Корабль стреляет строго вперёд по направлению своего носа. Попадание
 *    засчитывается, только если вражеский корабль реально стоит на линии
 *    огня — луч проходит в пределах корпуса цели. Если впереди никого нет —
 *    это промах, корабль не «доворачивает» на врага.
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

/** Радиус корпуса корабля в пикселях фото — половина среднего размера рамки */
function shipRadius(d: DetectedShip): number {
  return Math.max((d.bbox.w + d.bbox.h) / 4, 1);
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
      radius:     shipRadius(d),
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

/**
 * Определяет, во что попадёт лазер стрелка — луч из носа стрелка в направлении
 * его угла. Никакой «автонаводки»: цель — это ПЕРВЫЙ корабль на пути луча.
 *
 * Луч останавливает первый же корабль, чей корпус он пересекает (любого цвета):
 *  - если этот корабль впереди (проекция на луч > 0),
 *  - и луч проходит в пределах его корпуса (перпендикуляр ≤ радиус корабля).
 *
 * Затем:
 *  - если первый на пути — враг, это попадание, возвращаем его;
 *  - если первый на пути — союзник, стрелять сквозь него нельзя: выстрел
 *    уходит впустую, возвращаем null (промах);
 *  - если на линии огня вообще никого нет — тоже null (промах).
 *
 * Так корабль не «простреливает» стоящих впереди и не бьёт дальнюю цель,
 * в которую физически не смотрит.
 */
export function findTarget(
  shooter: BattleShip,
  ships: BattleShip[],
): BattleShip | null {
  const rad = (shooter.angle * Math.PI) / 180;
  const dx  = Math.cos(rad);
  const dy  = Math.sin(rad);

  // Ищем ПЕРВЫЙ корабль на пути луча — независимо от цвета
  let first: BattleShip | null = null;
  let bestDist = Infinity;

  for (const ship of ships) {
    if (!ship.alive || ship.id === shooter.id) continue;

    // Вектор от стрелка до потенциальной цели
    const ex = ship.x - shooter.x;
    const ey = ship.y - shooter.y;

    // Проекция на направление луча: если <= 0, корабль позади стрелка
    const proj = ex * dx + ey * dy;
    if (proj <= 0) continue;

    // Перпендикулярное расстояние от линии луча — луч должен пройти сквозь
    // корпус корабля, иначе он не на линии огня
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp > ship.radius) continue;

    if (proj < bestDist) {
      bestDist = proj;
      first = ship;
    }
  }

  // Стреляем только если первый на пути — враг; союзник впереди блокирует луч
  if (!first || first.color === shooter.color) return null;
  return first;
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

/** Сколько живых цветов (команд) осталось на арене */
function aliveColorCount(ships: BattleShip[]): number {
  return new Set(ships.filter(s => s.alive).map(s => s.color)).size;
}

/** Предохранитель от бесконечного цикла, если бой зашёл в сталемат */
const MAX_ROUNDS = 50;

/**
 * Прогоняет весь бой раундами (каждый раунд — все живые корабли стреляют
 * в порядке убывания инициативы) до тех пор, пока не останется один цвет
 * выживших или раунд не проходит без единого попадания/блока (стрелять
 * больше не во кого/нечем — цели нет на линии огня).
 * Возвращает итоговые корабли, лог всех выстрелов (со снимками HP/alive
 * после каждого хода) и победителя.
 */
export function simulateBattle(detected: DetectedShip[]): BattleResult {
  const ships = buildBattleShips(detected);
  const order = getFiringOrder(ships);
  const events: ShotEvent[] = [];

  for (let round = 0; round < MAX_ROUNDS && aliveColorCount(ships) > 1; round++) {
    let progressed = false;

    for (const shooter of order) {
      if (!shooter.alive) continue;
      if (aliveColorCount(ships) <= 1) break;

      const target = findTarget(shooter, ships);
      let result: ShotResult = 'miss';
      let shieldSide: ShotEvent['shieldSide'];

      if (target) {
        const shot = resolveShot(shooter, target);
        result     = shot.result;
        shieldSide = shot.shieldSide;
        progressed = true;
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

    if (!progressed) break; // стрелять больше не во кого — дальше ничего не изменится
  }

  const survivors      = ships.filter(s => s.alive);
  const survivorColors = [...new Set(survivors.map(s => s.color))];
  const winner = survivorColors.length === 1 ? survivorColors[0] : null;

  return { ships, events, winner };
}
