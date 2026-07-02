import type { ShipColor, ShipType } from './ships';

// ─── Корабль во время боя ─────────────────────────────────────────────────────

export interface BattleShip {
  id: string;
  color: ShipColor;
  type: ShipType;
  label: string;
  // где стоит на фото, в пикселях
  x: number;
  y: number;
  // куда смотрит нос, градусы (0 = вправо, дальше по часовой)
  angle: number;
  // радиус корпуса в пикселях — по нему решаем, попал луч или нет
  radius: number;
  hp: number;
  maxHp: number;
  initiative: number;
  shields: { front: boolean; rear: boolean; left: boolean; right: boolean };
  alive: boolean;
}

// ─── Один выстрел ─────────────────────────────────────────────────────────────

export type ShotResult = 'hit' | 'blocked' | 'miss';

export interface ShotEvent {
  shooterId: string;
  targetId: string | null;   // null — промах
  result: ShotResult;
  // какой борт поймал щитом (когда 'blocked')
  shieldSide?: 'front' | 'rear' | 'left' | 'right';
  // как выглядели HP и живые сразу после этого хода — нужно для перемотки
  hpSnapshot: Record<string, number>;
  aliveSnapshot: Record<string, boolean>;
  // с какой инициативой стрелял
  initiativeRoll: number;
}
