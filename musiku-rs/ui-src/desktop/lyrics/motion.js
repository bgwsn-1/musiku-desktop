// Matematika sapuan kata + penulisan CSS variable. Modul ini tidak tahu soal
// React maupun player: dipanggil animator sekali per frame.

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export const motionOff = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Musiku punya timing per baris, bukan per kata. Panjang kata dipakai untuk
 *  membagi baris secara proporsional — efek sapuan, bukan sinkronisasi asli. */
export function wordTiming(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const total = words.reduce((n, w) => n + w.length + 1, 0) || 1;
  let acc = 0;
  return words.map((word) => {
    const start = acc / total;
    acc += word.length + 1;
    return { word, start, end: acc / total };
  });
}

export function fillOf(spans, k, progress) {
  const s = spans[k];
  if (!s) return 0;
  return clamp((progress - s.start) / Math.max(0.0001, s.end - s.start), 0, 1) * 100;
}

// Baris yang sama masuk rAF ratusan kali; jangan memecah teks berulang.
const spanCache = new Map();
export function spansOf(text) {
  let spans = spanCache.get(text);
  if (!spans) {
    spans = wordTiming(text);
    if (spanCache.size > 300) spanCache.clear();
    spanCache.set(text, spans);
  }
  return spans;
}

export const setVar = (node, name, value) => {
  const next = String(value);
  if (node.style.getPropertyValue(name) !== next) node.style.setProperty(name, next);
};

// Skala Spicy: 0.75 → 1.05 di 0.7 → 1 saat kata selesai.
export const wordScale = (k) =>
  k < 0.7 ? 0.75 + (0.3 * k) / 0.7 : 1.05 - (0.05 * (k - 0.7)) / 0.3;

export function writeWord(node, fill) {
  const lit = fill / 100;
  const glow = lit < 0.6 ? lit / 0.6 : 1;
  const y = -0.12 * (lit < 0.9 ? lit / 0.9 : (1 - lit) / 0.1);
  setVar(node, "--sl-gradient-position", `${(-20 + fill * 1.2).toFixed(2)}%`);
  setVar(node, "--sl-glow", glow.toFixed(3));
  setVar(node, "--sl-glow-alpha", `${(8 + glow * 52).toFixed(1)}%`);
  setVar(node, "--sl-y", `${y.toFixed(4)}em`);
  const scale = wordScale(lit).toFixed(3);
  if (node.style.scale !== scale) node.style.scale = scale;
  node.classList.toggle("lit", fill > 6);
}

export function writeLine(root, progress) {
  setVar(root, "--sl-progress", `${(progress * 100).toFixed(2)}%`);
  root.querySelectorAll(".sl-dots i").forEach((dot, k) => {
    const opacity = progress * 3 > k ? "1" : "0.3";
    if (dot.style.opacity !== opacity) dot.style.opacity = opacity;
  });
}
