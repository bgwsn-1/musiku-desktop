// Port 1:1 dari YesPlayMusic lib/cover_color.dart untuk mengekstrak warna sampul:
// - dominant: warna dominan asli lewat kuantisasi 4-bit (4096 bucket) + bobot chroma^2
// - deep: versi gelap untuk latar penuh
// - card: warna latar spine/kartu (lightness 0.30..0.82, saturasi maks 0.72)
// - onCard: #0B0B0D bila luminance > 0.42, selain itu #FFFFFF
import { useEffect, useState } from "react";

export const FALLBACK_PALETTE = {
  dominant: "#7b1d2e",
  deep: "#4c141f",
  card: "#7b1d2e",
  onCard: "#ffffff",
  darkText: false,
};

// Palet vinyl fallback deterministik bila gambar belum selesai atau gagal diekstrak
const CURATED_FALLBACKS = [
  { card: "#9de3dc", onCard: "#0b0b0d", darkText: true },
  { card: "#dfd5cc", onCard: "#0b0b0d", darkText: true },
  { card: "#c84b28", onCard: "#ffffff", darkText: false },
  { card: "#7b1d2e", onCard: "#ffffff", darkText: false },
  { card: "#b2c8df", onCard: "#0b0b0d", darkText: true },
  { card: "#e8dfd5", onCard: "#0b0b0d", darkText: true },
  { card: "#6941a8", onCard: "#ffffff", darkText: false },
  { card: "#ea5b93", onCard: "#0b0b0d", darkText: true },
  { card: "#4f81a8", onCard: "#ffffff", darkText: false },
  { card: "#d94f30", onCard: "#ffffff", darkText: false },
];

export function fallbackForKey(key) {
  let h = 0;
  const s = String(key || "");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  const pick = CURATED_FALLBACKS[Math.abs(h) % CURATED_FALLBACKS.length];
  return {
    dominant: pick.card,
    deep: "#2a2028",
    ...pick,
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function toHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function relativeLuminance(r, g, b) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function paletteFromRgb(r, g, b) {
  const [h, rawS, rawL] = rgbToHsl(r, g, b);
  const chromatic = rawS > 0.12;
  const s = chromatic ? Math.min(rawS, 0.72) : 0;
  const deepRgb = hslToRgb(h, s, chromatic ? 0.3 : 0.2);
  const cardL = Math.max(0.3, Math.min(0.82, rawL));
  const cardRgb = hslToRgb(h, s, cardL);
  const lum = relativeLuminance(cardRgb[0], cardRgb[1], cardRgb[2]);
  const darkText = lum > 0.42;
  return {
    dominant: toHex(r, g, b),
    deep: toHex(deepRgb[0], deepRgb[1], deepRgb[2]),
    card: toHex(cardRgb[0], cardRgb[1], cardRgb[2]),
    onCard: darkText ? "#0b0b0d" : "#ffffff",
    darkText,
  };
}

function dominantFromPixels(rgba) {
  const count = new Int32Array(4096);
  const sumR = new Int32Array(4096);
  const sumG = new Int32Array(4096);
  const sumB = new Int32Array(4096);
  let total = 0,
    ar = 0,
    ag = 0,
    ab = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const r = rgba[i],
      g = rgba[i + 1],
      b = rgba[i + 2];
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    count[k]++;
    sumR[k] += r;
    sumG[k] += g;
    sumB[k] += b;
    total++;
    ar += r;
    ag += g;
    ab += b;
  }
  if (total === 0) return [123, 29, 46];
  const avg = [Math.floor(ar / total), Math.floor(ag / total), Math.floor(ab / total)];

  let best = -1;
  let bestScore = 0;
  let chromaticPixels = 0;
  for (let k = 0; k < 4096; k++) {
    const n = count[k];
    if (n === 0) continue;
    const r = sumR[k] / n / 255;
    const g = sumG[k] / n / 255;
    const b = sumB[k] / n / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const chroma = mx - mn;
    const l = (mx + mn) / 2;
    if (chroma > 0.16) chromaticPixels += n;
    let w = 0.01 + chroma * chroma;
    if (l < 0.12 || l > 0.92) w *= 0.15;
    const score = n * w;
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  if (best < 0 || chromaticPixels < total * 0.04) return avg;

  const seedRgb = [
    Math.floor(sumR[best] / count[best]),
    Math.floor(sumG[best] / count[best]),
    Math.floor(sumB[best] / count[best]),
  ];
  const [seedH] = rgbToHsl(seedRgb[0], seedRgb[1], seedRgb[2]);

  let n = 0,
    sr = 0,
    sg = 0,
    sb = 0;
  for (let k = 0; k < 4096; k++) {
    const c = count[k];
    if (c === 0) continue;
    const cr = Math.floor(sumR[k] / c);
    const cg = Math.floor(sumG[k] / c);
    const cb = Math.floor(sumB[k] / c);
    const [ch, cs, cl] = rgbToHsl(cr, cg, cb);
    if (cs < 0.2 || cl < 0.12 || cl > 0.92) continue;
    const dh = Math.abs(ch - seedH);
    if (Math.min(dh, 360 - dh) > 18) continue;
    n += c;
    sr += sumR[k];
    sg += sumG[k];
    sb += sumB[k];
  }
  if (n === 0) return seedRgb;
  return [Math.floor(sr / n), Math.floor(sg / n), Math.floor(sb / n)];
}

const paletteCache = new Map();
const pendingCache = new Map();

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img load failed"));
    img.src = src;
  });
}

function samplePalette(img) {
  const size = 40;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const [r, g, b] = dominantFromPixels(data);
  return paletteFromRgb(r, g, b);
}

export async function extractCoverPalette(url, fallbackKey) {
  if (!url) return fallbackForKey(fallbackKey);
  if (paletteCache.has(url)) return paletteCache.get(url);
  if (pendingCache.has(url)) return pendingCache.get(url);

  const p = (async () => {
    // Coba langsung dulu (lh3.googleusercontent mengirim CORS header), fallback ke /api/artwork-proxy
    const candidates = [url];
    if (/^https:\/\//i.test(url)) {
      candidates.push(`/api/artwork-proxy?url=${encodeURIComponent(url)}`);
    }
    for (const src of candidates) {
      try {
        const img = await loadImg(src);
        const pal = samplePalette(img);
        paletteCache.set(url, pal);
        return pal;
      } catch {
        // Coba kandidat berikutnya
      }
    }
    const fb = fallbackForKey(fallbackKey || url);
    paletteCache.set(url, fb);
    return fb;
  })().finally(() => {
    pendingCache.delete(url);
  });

  pendingCache.set(url, p);
  return p;
}

export function useCoverPalettes(items) {
  const [map, setMap] = useState(() => {
    const init = {};
    for (const it of items) {
      if (it.thumb && paletteCache.has(it.thumb)) {
        init[it.id] = paletteCache.get(it.thumb);
      }
    }
    return init;
  });

  const sig = items.map((it) => `${it.id}:${it.thumb || ""}`).join("|");

  useEffect(() => {
    let alive = true;
    const updates = {};
    let pending = 0;

    for (const it of items) {
      if (!it.thumb) {
        updates[it.id] = fallbackForKey(it.id || it.title);
        continue;
      }
      if (paletteCache.has(it.thumb)) {
        updates[it.id] = paletteCache.get(it.thumb);
        continue;
      }
      pending++;
      extractCoverPalette(it.thumb, it.id || it.title).then((pal) => {
        if (!alive) return;
        setMap((prev) => (prev[it.id] === pal ? prev : { ...prev, [it.id]: pal }));
      });
    }

    if (Object.keys(updates).length > 0) {
      setMap((prev) => ({ ...prev, ...updates }));
    }
    void pending;
    return () => {
      alive = false;
    };
  }, [sig]);

  return map;
}
