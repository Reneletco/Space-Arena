/**
 * HSV blob-based ship detector.
 *
 * Pipeline:
 *  1. Draw image onto an offscreen canvas
 *  2. For each target color: threshold pixels in HSV → binary mask
 *  3. Connected-component labeling (flood-fill queue)
 *  4. Filter blobs by min area
 *  5. Compute centroid, bounding box, and nose angle via PCA on blob pixels
 *  6. Assign ship type by blob area rank (largest → cruiser, etc.)
 *  7. Return DetectedShip[]
 */

import type { DetectedShip, ShipColor, ShipType } from '../types/ships';
import { COLOR_RANGES, RED_LOW_RANGE } from '../types/ships';

// ─── Tunables ────────────────────────────────────────────────────────────────

const MIN_BLOB_AREA = 300;   // px² — ignore noise
const MAX_BLOB_AREA = 80000; // px² — ignore entire background

// Ship-type assignment by relative size inside one color group
// (sorted desc by area: index 0 = largest blob of this color)
const TYPE_BY_SIZE_RANK: ShipType[] = ['cruiser', 'destroyer', 'interceptor', 'scout'];

// ─── RGB → HSV ───────────────────────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if      (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else                 h = ((rn - gn) / d + 4) / 6;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;
  return [h * 360, s, v];
}

// ─── Pixel membership ────────────────────────────────────────────────────────

function isRed(h: number, s: number, v: number): boolean {
  const r  = COLOR_RANGES.red;
  const rl = RED_LOW_RANGE;
  const sv = s >= r.sMin && s <= r.sMax && v >= r.vMin && v <= r.vMax;
  return sv && (
    (h >= r.hMin  && h <= r.hMax) ||
    (h >= rl.hMin && h <= rl.hMax)
  );
}

function inRange(h: number, s: number, v: number, color: ShipColor): boolean {
  if (color === 'red') return isRed(h, s, v);
  const rng = COLOR_RANGES[color];
  return (
    h >= rng.hMin && h <= rng.hMax &&
    s >= rng.sMin && s <= rng.sMax &&
    v >= rng.vMin && v <= rng.vMax
  );
}

// ─── Blob detection via flood fill ───────────────────────────────────────────

interface Blob {
  pixels: Array<[number, number]>; // [x, y]
  area: number;
}

function findBlobs(mask: Uint8Array, width: number, height: number): Blob[] {
  const visited = new Uint8Array(width * height);
  const blobs: Blob[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx] || visited[idx]) continue;

      // BFS flood fill
      const pixels: Array<[number, number]> = [];
      const queue: number[] = [idx];
      visited[idx] = 1;

      while (queue.length) {
        const cur = queue.pop()!;
        const cx = cur % width;
        const cy = (cur / width) | 0;
        pixels.push([cx, cy]);

        const neighbors = [
          cur - 1, cur + 1,
          cur - width, cur + width,
        ];
        for (const n of neighbors) {
          if (n < 0 || n >= width * height) continue;
          const nx = n % width;
          const ny = (n / width) | 0;
          if (Math.abs(nx - cx) + Math.abs(ny - cy) > 1) continue; // edge wrap guard
          if (!mask[n] || visited[n]) continue;
          visited[n] = 1;
          queue.push(n);
        }
      }

      blobs.push({ pixels, area: pixels.length });
    }
  }

  return blobs;
}

// ─── Angle via PCA ───────────────────────────────────────────────────────────

/**
 * Returns the principal axis angle of a blob in degrees [0, 360).
 * We compute the 2×2 covariance matrix of pixel positions and return
 * the eigenvector direction with the larger eigenvalue.
 * The sign is resolved by checking which half of the blob is "pointier"
 * (smaller area) — that end is assumed to be the nose.
 */
function blobAngle(pixels: Array<[number, number]>): number {
  let mx = 0, my = 0;
  for (const [x, y] of pixels) { mx += x; my += y; }
  mx /= pixels.length;
  my /= pixels.length;

  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pixels) {
    const dx = x - mx, dy = y - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }

  // Eigenvector of 2×2 symmetric matrix
  const trace = sxx + syy;
  const det   = sxx * syy - sxy * sxy;
  const disc  = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const lam1  = trace / 2 + disc; // larger eigenvalue

  let axisAngle: number;
  if (Math.abs(sxy) < 1e-9) {
    axisAngle = sxx >= syy ? 0 : 90;
  } else {
    axisAngle = Math.atan2(lam1 - sxx, sxy) * (180 / Math.PI);
  }

  // Resolve 180° ambiguity: split blob along perpendicular and find the
  // half with fewer pixels (the "pointy" nose end).
  const rad = axisAngle * (Math.PI / 180);
  const dx = Math.cos(rad), dy = Math.sin(rad);

  let frontCount = 0, rearCount = 0;
  for (const [x, y] of pixels) {
    const dot = (x - mx) * dx + (y - my) * dy;
    if (dot >= 0) frontCount++; else rearCount++;
  }

  // Nose = smaller half
  const noseAngle = frontCount <= rearCount ? axisAngle : (axisAngle + 180) % 360;
  return (noseAngle + 360) % 360;
}

// ─── Bounding box ────────────────────────────────────────────────────────────

function bboxOf(pixels: Array<[number, number]>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pixels) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect ships in a captured image.
 *
 * @param imageDataUrl  base64 data URL (jpeg/png) from useCamera.capture()
 * @param scale         downscale factor for speed (default 0.35)
 * @returns             promise resolving to DetectedShip[]
 */
export async function detectShips(
  imageDataUrl: string,
  scale = 0.35,
): Promise<DetectedShip[]> {
  // Load image
  const img = await loadImage(imageDataUrl);
  const W = Math.round(img.naturalWidth  * scale);
  const H = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);

  const { data } = ctx.getImageData(0, 0, W, H);

  const results: DetectedShip[] = [];
  const colors: ShipColor[] = ['red', 'blue', 'green', 'yellow'];

  for (const color of colors) {
    // Build binary mask for this color
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const [h, s, v] = rgbToHsv(r, g, b);
      if (inRange(h, s, v, color)) mask[i] = 1;
    }

    const blobs = findBlobs(mask, W, H)
      .filter(bl => bl.area >= MIN_BLOB_AREA && bl.area <= MAX_BLOB_AREA)
      .sort((a, b) => b.area - a.area)
      .slice(0, 4); // max 4 ships per color (unlikely but safe)

    for (let rank = 0; rank < blobs.length; rank++) {
      const blob = blobs[rank];

      let cx = 0, cy = 0;
      for (const [x, y] of blob.pixels) { cx += x; cy += y; }
      cx = (cx / blob.pixels.length) / scale;
      cy = (cy / blob.pixels.length) / scale;

      const rawBbox = bboxOf(blob.pixels);
      const bbox = {
        x: rawBbox.x / scale,
        y: rawBbox.y / scale,
        w: rawBbox.w / scale,
        h: rawBbox.h / scale,
      };

      const angle = blobAngle(blob.pixels);
      const type: ShipType = TYPE_BY_SIZE_RANK[rank] ?? 'scout';

      results.push({
        id:    `${color}-${rank}`,
        color,
        type,
        cx, cy,
        bbox,
        angle,
      });
    }
  }

  return results;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
