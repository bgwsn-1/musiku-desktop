// Data lirik untuk panel desktop Musiku.
// Sumber tetap /api/lyrics/[id] (LRCLIB / YouTube Music) — tidak ada API baru
// dan tidak mengubah logika sinkronisasi web/Android.

/** Parser LRC yang sama seperti parser Musiku. Diisolasi di sini supaya alias
 *  desktop `@/components/LyricsPanel` tidak membuat import melingkar. */
export function parseLrc(raw) {
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const matches = [...(line?.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g) ?? [])];
    if (!matches.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    for (const m of matches) {
      const time =
        Number(m[1]) * 60 + Number(m[2]) + Number((m[3] ?? "0").padEnd(3, "0")) / 1000;
      out.push({ time, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Ubah respons endpoint lirik menjadi baris siap pakai UI desktop:
 *  - synced           → timestamp LRC asli
 *  - text + durasi    → estimasi merata, diberi label "perkiraan" di status
 *  - text tanpa durasi→ ditampilkan apa adanya (plain)
 */
export function buildLyrics(data, duration) {
  if (!data?.text) return { lines: [], estimated: false, plain: null };
  if (data.synced) return { lines: parseLrc(data.text), estimated: false, plain: null };
  if (!(duration > 0)) {
    return { lines: [], estimated: false, plain: data.text.split(/\r?\n/) };
  }
  const raw = data.text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const step = duration / Math.max(1, raw.length);
  return {
    lines: raw.map((text, i) => ({ time: i * step, text })),
    estimated: true,
    plain: null,
  };
}

export function lyricsStatus(data, loading, estimated) {
  if (estimated) return "Lirik · sinkronisasi perkiraan";
  if (data?.source === "lrclib") return "Lirik sinkron · LRCLIB";
  if (data?.source === "youtube-music") return "Lirik · YouTube Music";
  if (loading) return "Mencari lirik…";
  return "Tidak ada lirik";
}
