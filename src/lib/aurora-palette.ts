// Ekstraksi palet dominan dari cover album untuk latar aurora immersive.
// Murni client (canvas), aman dipanggil berulang; hasil di-cache per URL.

export const AURORA_FALLBACK = ["#2b2f4a", "#3a2a55", "#1f3a4d", "#402a3a"];

const SIZE = 48;
const cache = new Map<string, string[]>();

type RGB = { r: number; g: number; b: number; n: number };

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

const lum = (r: number, g: number, b: number): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const sat = (r: number, g: number, b: number): number => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};

const dist = (a: RGB, b: RGB): number =>
  Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

const isUsable = (c: RGB): boolean => {
  const l = lum(c.r, c.g, c.b);
  if (l < 0.07 || l > 0.93) return false; // terlalu gelap / putih
  if (sat(c.r, c.g, c.b) < 0.1) return false; // abu
  return true;
};

/**
 * Ambil 4 warna dominan yang saling jauh. Kalau gambar gagal dimuat /
 * semuanya ter-skip, kembalikan palet fallback gelap.
 */
export async function extractPalette(url: string): Promise<string[]> {
  const hit = cache.get(url);
  if (hit) return hit;

  const colors = await loadImage(url)
    .then((img) => sample(img))
    .catch(() => null);

  // Gagal load / CORS: jangan cache fallback, biar bisa retry di lain waktu.
  if (!colors) return [...AURORA_FALLBACK];
  const out = pickColors(colors);
  cache.set(url, out);
  return out;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("cover gagal dimuat"));
    img.src = url;
  });
}

/** Kuantisasi 4 bit per kanal; alpha ikut menimbang. */
function sample(img: HTMLImageElement): RGB[] {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2D tidak tersedia");
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const px = ctx.getImageData(0, 0, SIZE, SIZE).data;

  const buckets = new Map<string, RGB>();
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3] / 255;
    if (a < 0.12) continue;
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    e.r += r * a;
    e.g += g * a;
    e.b += b * a;
    e.n += a;
    buckets.set(key, e);
  }
  return [...buckets.values()].map((e) => ({
    r: e.r / e.n,
    g: e.g / e.n,
    b: e.b / e.n,
    n: e.n,
  }));
}

function pickColors(buckets: RGB[] | null): string[] {
  if (!buckets || buckets.length === 0) return [...AURORA_FALLBACK];

  // Skor: jumlah piksel × saturasi, jadi warna cerah yang dominan menang.
  const scored = buckets
    .filter(isUsable)
    .sort(
      (a, b) =>
        b.n * sat(b.r, b.g, b.b) - a.n * sat(a.r, a.g, a.b),
    );
  if (scored.length === 0) return [...AURORA_FALLBACK];

  const picked: RGB[] = [];
  for (const c of scored) {
    if (picked.length >= 4) break;
    if (picked.every((p) => dist(p, c) > 42)) picked.push(c);
  }
  // Kalau kurang dari 4, turunkan ambang jarak lalu isi sisa dari bucket lain.
  if (picked.length < 4) {
    for (const c of scored) {
      if (picked.length >= 4) break;
      if (picked.every((p) => dist(p, c) > 20)) picked.push(c);
    }
  }
  // Sisa warna diisi dari fallback (bukan duplikat) supaya 4 blob tetap beda.
  const out = picked.slice(0, 4).map((c) => toHex(c.r, c.g, c.b));
  while (out.length < 4) out.push(AURORA_FALLBACK[out.length]);
  return out;
}
