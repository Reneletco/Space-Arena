/**
 * Draws detection overlay on a canvas:
 *  - Coloured bounding box
 *  - Label (color + type + id)
 *  - Arrow indicating nose direction
 */

import type { DetectedShip } from '../types/ships';
import { SHIP_STATS } from '../types/ships';

const COLOR_HEX: Record<string, string> = {
  red:    '#ff3333',
  blue:   '#3399ff',
  green:  '#33cc44',
  yellow: '#ffdd00',
};

export function drawOverlay(
  canvas: HTMLCanvasElement,
  imageDataUrl: string,
  ships: DetectedShip[],
): void {
  const img = new Image();
  img.onload = () => {
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    for (const ship of ships) {
      const hex = COLOR_HEX[ship.color] ?? '#ffffff';
      const { x, y, w, h } = ship.bbox;

      // Bounding box
      ctx.strokeStyle = hex;
      ctx.lineWidth   = Math.max(2, w * 0.03);
      ctx.strokeRect(x, y, w, h);

      // Semi-transparent fill
      ctx.fillStyle = hex + '22';
      ctx.fillRect(x, y, w, h);

      // Label background
      const label = `${SHIP_STATS[ship.type].label} (${ship.color})`;
      ctx.font = `bold ${Math.max(12, h * 0.15)}px sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = hex + 'cc';
      ctx.fillRect(x, y - Math.max(18, h * 0.18), tw + 8, Math.max(18, h * 0.18));

      // Label text
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 4, y - 4);

      // Nose arrow
      const cx = x + w / 2;
      const cy = y + h / 2;
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

      // Arrowhead
      const headLen = len * 0.28;
      const headAngle = 0.42; // ~24°
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - headLen * Math.cos(rad - headAngle),
        ey - headLen * Math.sin(rad - headAngle),
      );
      ctx.lineTo(
        ex - headLen * Math.cos(rad + headAngle),
        ey - headLen * Math.sin(rad + headAngle),
      );
      ctx.closePath();
      ctx.fillStyle = hex;
      ctx.fill();
    }
  };
  img.src = imageDataUrl;
}
