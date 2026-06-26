// ─── Ship types ──────────────────────────────────────────────────────────────

export type ShipColor = 'red' | 'blue' | 'green' | 'yellow';

export type ShipType = 'destroyer' | 'interceptor' | 'cruiser' | 'scout';

/** One blob found by the detector */
export interface DetectedShip {
  id: string;
  color: ShipColor;
  type: ShipType;
  /** Center X in image pixels */
  cx: number;
  /** Center Y in image pixels */
  cy: number;
  /** Bounding box */
  bbox: { x: number; y: number; w: number; h: number };
  /** Direction the ship nose points, degrees 0-360 (0 = right, CCW) */
  angle: number;
}

// ─── Color HSV ranges ────────────────────────────────────────────────────────

export interface HsvRange {
  hMin: number; hMax: number;   // 0-360
  sMin: number; sMax: number;   // 0-1
  vMin: number; vMax: number;   // 0-1
}

export const COLOR_RANGES: Record<ShipColor, HsvRange> = {
  red:    { hMin: 340, hMax: 360, sMin: 0.40, sMax: 1, vMin: 0.25, vMax: 1 },
  // red wraps around 0°, handled in code
  blue:   { hMin: 195, hMax: 255, sMin: 0.40, sMax: 1, vMin: 0.25, vMax: 1 },
  green:  { hMin:  80, hMax: 165, sMin: 0.35, sMax: 1, vMin: 0.20, vMax: 1 },
  yellow: { hMin:  35, hMax:  75, sMin: 0.45, sMax: 1, vMin: 0.35, vMax: 1 },
};

// Red low range (0-20°)
export const RED_LOW_RANGE: HsvRange =
  { hMin: 0, hMax: 20, sMin: 0.40, sMax: 1, vMin: 0.25, vMax: 1 };

// ─── Ship stats (for battle engine) ─────────────────────────────────────────

export interface ShipStats {
  hp: number;
  initiativeBonus: number;
  label: string;
}

export const SHIP_STATS: Record<ShipType, ShipStats> = {
  destroyer:   { hp: 2, initiativeBonus: 3, label: 'Разрушитель' },
  interceptor: { hp: 1, initiativeBonus: 5, label: 'Перехватчик' },
  cruiser:     { hp: 3, initiativeBonus: 0, label: 'Крейсер'     },
  scout:       { hp: 1, initiativeBonus: 7, label: 'Разведчик'   },
};
