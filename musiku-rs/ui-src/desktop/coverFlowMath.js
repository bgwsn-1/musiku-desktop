// Semua angka yang bisa di-tweak untuk Cover Flow ada di dua blok ini.
export const CF_LAYOUT = {
  /** Jarak cover pertama di kiri/kanan tengah (px). Sengaja lega agar label tidak tertutup. */
  spacingNear: 460,
  /** Jarak ±1 ke ±2; masih dekat dengan spacingNear supaya transisi gradual. */
  spacingFar: 400,
  /** Faktor pengecilan jarak setelah ±2 (gap ±2→±3 = spacingFar * f). */
  farDecay: 0.85,
  /** Sudut rotateY maksimal (derajat); kiri positif, kanan negatif. */
  angle: 52,
  angleMax: 60,
  /** Kedalaman mundur tiap langkah dari tengah. */
  zDepth: 220,
  /** Pengecilan tiap langkah dari tengah; landai supaya ±2 tidak menumpuk. */
  scaleStep: 0.12,
  scaleMin: 0.6,
  /** Opacity per jarak: 0, 1, 2, 3, 4+ (disela linear saat posisi pecahan). */
  opacityStops: [1, 0.85, 0.6, 0.4, 0.25],
  /** Label judul/artis hanya untuk cover aktif dan sejauh ini (±1). */
  labelDistance: 1,
  /** Berapa cover di kiri/kanan tengah yang dirender (2 * radius + 1). */
  radius: 4,
  /** Jarak lompatan yang masih memakai spring penuh. */
  jumpDistance: 2.5,
};

export const CF_MOTION = {
  /** Spring kalem: zeta = damping / (2*sqrt(stiffness)) ~= 0.97. */
  stiffness: 240,
  damping: 30,
  /** Snap supaya tidak ada ekor gerakan sub-piksel. */
  snapPx: 0.5,
  snapVel: 20,
  /** Lompat jauh: tween pendek tanpa overshoot. */
  jumpMs: 280,
  /** Inersia drag (detik kecepatan yang dipakai saat snap). */
  inertiaSec: 0.12,
  /** Throttle scroll: minimal ms antar langkah. */
  wheelMs: 130,
  /** Debounce setCover aurora saat geser cepat. */
  auroraMs: 150,
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Posisi X murni dari offset: +-1 renggang, setelah itu makin rapat. */
export function xForOffset(offset) {
  const d = Math.abs(offset);
  if (d <= 1) return offset * CF_LAYOUT.spacingNear;
  const next = Math.max(0, d - 1);
  const extra =
    CF_LAYOUT.spacingFar *
    (1 - Math.pow(CF_LAYOUT.farDecay, next)) /
    (1 - CF_LAYOUT.farDecay);
  return Math.sign(offset) * (CF_LAYOUT.spacingNear + extra);
}

function opacityForDistance(d) {
  const stops = CF_LAYOUT.opacityStops;
  const i = Math.min(Math.floor(d), stops.length - 1);
  const f = Math.min(1, d - i);
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  return a + (b - a) * f;
}

/**
 * Fungsi murni: offset pecahan (i - posisi) -> transform satu cover.
 * Hanya menulis transform/opacity/z-index; tidak ada layout-property.
 */
export function coverTransform(offset, reduce = false) {
  const d = Math.abs(offset);
  const sign = Math.sign(offset);
  if (reduce) {
    // Tanpa rotasi/spring: yang bukan aktif cuma fade, tetap di tempatnya.
    return {
      transform: `translate3d(${xForOffset(offset) * 0.35}px, 0, 0) scale(1)`,
      opacity: d < 0.5 ? 1 : 0,
      zIndex: 100 - Math.round(d * 10),
    };
  }
  const x = xForOffset(offset);
  const z = -Math.min(d, CF_LAYOUT.radius) * CF_LAYOUT.zDepth;
  const angle = Math.min(
    CF_LAYOUT.angleMax,
    CF_LAYOUT.angle * Math.min(1, 0.7 + d * 0.3),
  );
  const rot = -sign * angle; // kiri (offset < 0) menghadap ke dalam -> positif
  const scale = Math.max(CF_LAYOUT.scaleMin, 1 - d * CF_LAYOUT.scaleStep);
  return {
    transform: `translate3d(${x}px, 0, ${z}px) rotateY(${rot}deg) scale(${scale})`,
    opacity: opacityForDistance(d),
    zIndex: 100 - Math.round(d * 10),
  };
}
