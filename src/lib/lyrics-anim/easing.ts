// Util animasi lirik — milik Musiku (ditulis ulang, bukan salinan kode eksternal).

export interface AnimPoint {
  t: number;
  v: number;
}

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

/**
 * Spline piecewise (Catmull-Rom) melalui titik {(t, v)}. Input diurutkan by t;
 * evaluasi di luar rentang dijepit ke nilai ujung. Cukup untuk kurva kecil
 * seperti scale/glow/y-offset yang kita pakai.
 */
export class AnimSpline {
  private pts: AnimPoint[];

  constructor(points: AnimPoint[]) {
    this.pts = [...points].sort((a, b) => a.t - b.t);
  }

  at(t: number): number {
    const p = this.pts;
    if (p.length === 0) return 0;
    if (p.length === 1 || t <= p[0].t) return p[0].v;
    if (t >= p[p.length - 1].t) return p[p.length - 1].v;

    let i = 0;
    while (i < p.length - 2 && t > p[i + 1].t) i++;
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];

    const span = p2.t - p1.t || 1;
    const k = clamp((t - p1.t) / span);
    const k2 = k * k;
    const k3 = k2 * k;

    const h00 = 2 * k3 - 3 * k2 + 1;
    const h10 = k3 - 2 * k2 + k;
    const h01 = -2 * k3 + 3 * k2;
    const h11 = k3 - k2;
    const tangent1 = ((p2.v - p0.v) / ((p2.t - p0.t) || span)) * span;
    const tangent2 = ((p3.v - p1.v) / ((p3.t - p1.t) || span)) * span;
    return h00 * p1.v + h10 * tangent1 + h01 * p2.v + h11 * tangent2;
  }
}

/** cubic-bezier CSS sebagai fungsi JS (untuk scroll/easing manual). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const curveX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const curveY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = curveX(t) - x;
      if (Math.abs(error) < 1e-6) return curveY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - error / slope));
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-6) {
      if (curveX(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return curveY(t);
  };
}
