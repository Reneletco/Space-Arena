import type { ShipColor, ShipType } from './ships';

// ─── Боевой корабль (runtime-состояние) ──────────────────────────────────────

export interface BattleShip {
  id: string;
  color: ShipColor;
  type: ShipType;
  label: string;
  /** Позиция на арене (нормализована 0-1 от размеров исходного фото) */
  x: number;
  y: number;
  /** Угол носа в градусах (0 = вправо, по часовой) */
  angle: number;
  hp: number;
  maxHp: number;
  initiative: number;
  shields: { front: boolean; rear: boolean; left: boolean; right: boolean };
  alive: boolean;
}

// ─── Один ход (выстрел) ───────────────────────────────────────────────────────

export type ShotResult = 'hit' | 'blocked' | 'miss';

export interface ShotEvent {
  shooterId: string;
  targetId: string | null;   // null = промах
  result: ShotResult;
  /** Какой щит заблокировал (если result === 'blocked') */
  shieldSide?: 'front' | 'rear' | 'left' | 'right';
  /** Снимок HP всех кораблей ПОСЛЕ этого хода */
  hpSnapshot: Record<string, number>;
  /** Снимок alive ПОСЛЕ этого хода */
  aliveSnapshot: Record<string, boolean>;
  /** d10 результат броска инициативы стрелка */
  initiativeRoll: number;
}
