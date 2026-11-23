// Semua angka yang bisa di-tweak untuk Cover Flow ada di dua blok ini.
export const CF_LAYOUT = {
  /** Jarak antar indeks dalam px pada skala 1. */
  spacing: 300,
  /** Sudut rotateY maksimal (derajat); kiri positif, kanan negatif. */
  angle: 52,
  angleMax: 60,
  /** Kedalaman mundur tiap langkah dari tengah. */
  zDepth: 220,
  /** Pengecilan & pemudaran tiap langkah dari tengah. */
  scaleStep: 0.13,
  scaleMin: 0.62,
  opacityStep: 0.2,
  opacityMin: 0.12,
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
      transform: `translate3d(${offset * CF_LAYOUT.spacing * 0.35}px, 0, 0) scale(1)`,
      opacity: d < 0.5 ? 1 : 0,
      zIndex: 100 - Math.round(d * 10),
    };
  }
  const x = offset * CF_LAYOUT.spacing;
  const z = -Math.min(d, CF_LAYOUT.radius) * CF_LAYOUT.zDepth;
  const angle = Math.min(
    CF_LAYOUT.angleMax,
    CF_LAYOUT.angle * Math.min(1, 0.7 + d * 0.3),
  );
  const rot = -sign * angle; // kiri (offset < 0) menghadap ke dalam -> positif
  const scale = Math.max(CF_LAYOUT.scaleMin, 1 - d * CF_LAYOUT.scaleStep);
  const opacity = Math.max(CF_LAYOUT.opacityMin, 1 - d * CF_LAYOUT.opacityStep);
  return {
    transform: `translate3d(${x}px, 0, ${z}px) rotateY(${rot}deg) scale(${scale})`,
    opacity,
    zIndex: 100 - Math.round(d * 10),
  };
}
