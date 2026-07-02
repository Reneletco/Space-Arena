// Тут вся логика боя. Никакого React — просто функции: на входе корабли,
// на выходе готовый бой. Весь бой считается сразу, а арена потом его проигрывает.
//
// Пара правил, чтобы было понятно:
//  - цвет = команда, по своим не стреляем;
//  - корабль палит строго вперёд, куда смотрит нос. Не попал — значит промах,
//    никаких доворотов на врага.

import type { DetectedShip } from '../types/ships';
import { SHIP_STATS } from '../types/ships';
import type { BattleShip, ShotEvent, ShotResult } from '../types/battle';

// ─── Мелочи ─────────────────────────────────────────────────────────────────

// Кубик d10
export function rollD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}

// Разница углов, приведённая к -180..180
function angleDiff(a: number, b: number): number {
  let diff = ((b - a) % 360 + 360) % 360;
  if (diff > 180) diff -= 360;
  return diff;
}

// С какого борта прилетело: сравниваем угол луча с тем, куда смотрит цель
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

// Радиус корабля в пикселях — грубо, половина среднего размера рамки
function shipRadius(d: DetectedShip): number {
  return Math.max((d.bbox.w + d.bbox.h) / 4, 1);
}

// ─── Инициатива ─────────────────────────────────────────────────────────────

// Делаем из распознанных кораблей боевые: кидаем инициативу, ставим HP и щиты
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

// Кто ходит первым — у кого инициатива больше
export function getFiringOrder(ships: BattleShip[]): BattleShip[] {
  return [...ships].sort((a, b) => b.initiative - a.initiative);
}

// ─── Линия огня ─────────────────────────────────────────────────────────────

// Куда прилетит выстрел. Луч летит из носа стрелка прямо вперёд и упирается
// в ПЕРВЫЙ корабль на пути (неважно какого цвета). Если это враг — попали.
// Если впереди свой — стрелять сквозь него нельзя, выстрел в молоко. Если
// впереди пусто — тоже промах.
export function findTarget(
  shooter: BattleShip,
  ships: BattleShip[],
): BattleShip | null {
  const rad = (shooter.angle * Math.PI) / 180;
  const dx  = Math.cos(rad);
  const dy  = Math.sin(rad);

  let first: BattleShip | null = null;
  let bestDist = Infinity;

  for (const ship of ships) {
    if (!ship.alive || ship.id === shooter.id) continue;

    const ex = ship.x - shooter.x;
    const ey = ship.y - shooter.y;

    // proj < 0 — корабль за спиной, пропускаем
    const proj = ex * dx + ey * dy;
    if (proj <= 0) continue;

    // насколько корабль в стороне от луча — если дальше своего радиуса, мимо
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp > ship.radius) continue;

    // среди тех, кто на луче, берём ближайшего
    if (proj < bestDist) {
      bestDist = proj;
      first = ship;
    }
  }

  // стреляем, только если ближайший на пути — враг
  if (!first || first.color === shooter.color) return null;
  return first;
}

// ─── Щиты и урон ────────────────────────────────────────────────────────────

export interface ResolvedShot {
  result: ShotResult;
  // какой борт словил выстрел (когда result === 'blocked')
  shieldSide?: 'front' | 'rear' | 'left' | 'right';
}

// Считаем результат выстрела. Целый щит гасит выстрел (и сам вылетает),
// иначе -1 HP. Дошло до нуля — корабль всё. Меняем target прямо на месте.
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

// ─── Сам бой ────────────────────────────────────────────────────────────────

export interface BattleResult {
  ships:  BattleShip[];
  events: ShotEvent[];
  // цвет победителя, либо null — ничья
  winner: string | null;
}

// Сколько цветов (команд) ещё в живых
function aliveColorCount(ships: BattleShip[]): number {
  return new Set(ships.filter(s => s.alive).map(s => s.color)).size;
}

// Чтобы бой не крутился вечно, если все друг друга не достают
const MAX_ROUNDS = 50;

// Гоняем раунды, пока не останется одна команда. В каждом раунде все живые
// стреляют по очереди инициативы. Каждый выстрел пишем в лог вместе со снимком
// HP и живых — чтобы потом можно было мотать бой вперёд-назад.
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

    // за весь раунд ни одного выстрела — дальше ничего не поменяется, выходим
    if (!progressed) break;
  }

  const survivors      = ships.filter(s => s.alive);
  const survivorColors = [...new Set(survivors.map(s => s.color))];
  const winner = survivorColors.length === 1 ? survivorColors[0] : null;

  return { ships, events, winner };
}
