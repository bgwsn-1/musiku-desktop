/**
 * Logo nama (wordmark) artis. Dua sumber, dicari berurutan:
 *  1. Wikidata klaim "logo image" (P154) — wordmark resmi di Wikimedia Commons.
 *  2. TheAudioDB field strArtistLogo — clear-logo komunitas, cakupan lebih luas.
 * Artis yang tidak ada di keduanya tetap memakai nama teks di UI.
 * URL yang dibalik adalah URL sumber; gambar di-proxy oleh /api/artist-logo/file
 * supaya bisa dibaca canvas untuk deteksi warna.
 */
import { createHash } from "node:crypto";

const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { url: string | null; exp: number }>();
const pending = new Map<string, Promise<string | null>>();
const UA = "Musiku/1.0 (music web player; contact: user)";

/** deskripsi harus terdengar musikal — hindari orang/konta/negara dengan nama sama */
const MUSIC_DESC = /(rapper|singer|musician|band|dj|group|artist|songwriter|producer|vocalist|duo|trio)/i;

/** logo dari TheAudioDB (API publik, kunci tier gratis) */
async function tadbLogo(name: string): Promise<string | null> {
  const q = new URLSearchParams({ s: name });
  const res = await fetch(
    `https://www.theaudiodb.com/api/v1/json/123/search.php?${q}`,
    { headers: { "user-agent": UA } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    artists?: Array<{ strArtistLogo?: string | null }>;
  };
  const hit = (data.artists ?? []).find((a) => a.strArtistLogo);
  return hit?.strArtistLogo ?? null;
}

/** URL thumbnail langsung dari upload.wikimedia.org. Lebar harus salah
 *  satu ukuran tetap yang diizinkan Wikimedia, bukan angka bebas. */
function commonsThumb(file: string): string {
  const clean = file.replace(/ /g, "_");
  const h = md5(clean);
  const isSvg = /\.svg$/i.test(clean);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${clean}/500px-${clean}${isSvg ? ".png" : ""}`;
}

/** logo dari Wikidata (klaim P154 pada entis artis yang pertama cocok) */
async function wikidataLogo(name: string): Promise<string | null> {
  const q = new URLSearchParams({
    action: "wbsearchentities",
    search: name,
    language: "en",
    format: "json",
    limit: "5",
    type: "item",
  });
  const res = await fetch(`https://www.wikidata.org/w/api.php?${q}`, {
    headers: { "user-agent": UA },
  });
  if (!res.ok) return null;
  const found = (await res.json()) as {
    search?: Array<{ id: string; description?: string }>;
  };
  const entity = (found.search ?? []).find((s) => {
    const desc = (s.description ?? "").toLowerCase();
    return !desc.includes("disambiguation") && MUSIC_DESC.test(desc);
  });
  if (!entity) return null;

  const cq = new URLSearchParams({
    action: "wbgetclaims",
    entity: entity.id,
    property: "P154",
    format: "json",
  });
  const cres = await fetch(`https://www.wikidata.org/w/api.php?${cq}`, {
    headers: { "user-agent": UA },
  });
  if (!cres.ok) return null;
  const cdata = (await cres.json()) as {
    claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
  };
  const claims = cdata.claims?.P154 ?? [];
  const file = claims[0]?.mainsnak?.datavalue?.value;
  if (typeof file !== "string" || !file) return null;
  return commonsThumb(file);
}

/** md5 hex buat direktori thumbnail Commons */
function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export function artistLogo(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.url);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      return (await wikidataLogo(name)) ?? (await tadbLogo(name));
    } catch {
      return null;
    }
  })();

  pending.set(key, p);
  p.then((url) => {
    cache.set(key, { url, exp: Date.now() + TTL });
  }).finally(() => {
    pending.delete(key);
  });
  return p;
}
