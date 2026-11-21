// Tampilan lirik terinspirasi Spicy Lyrics (github.com/Spikerko/spicy-lyrics).
// Implementasi ulang untuk Musiku: tetap MIT, tanpa menyalin kode AGPL repo itu.
// Hanya dipakai bundle desktop lewat alias `@/components/LyricsPanel`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { Artwork } from "@/components/Artwork";
import { IconClose } from "@/components/Icons";

/** Parser LRC — sama persis dengan parser Musiku, ditaruh di sini supaya
 *  alias desktop tidak membuat import melingkar ke LyricsPanel asli. */
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

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const motionOff = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function openExternal(url) {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (invoke) {
    void invoke("open_external", { url }).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Bagi durasi baris secara proporsional panjang kata. Musiku punya timing
 *  per baris (LRCLIB / YouTube Music), bukan per kata seperti TTML Spicy —
 *  jadi ini hanya estimasi untuk efek sapuan, bukan sinkronisasi asli. */
function wordSpans(text, progress) {
  const words = text.split(/\s+/).filter(Boolean);
  const total = words.reduce((n, w) => n + w.length + 1, 0) || 1;
  let acc = 0;
  return words.map((word, k) => {
    const start = acc / total;
    acc += word.length + 1;
    const end = acc / total;
    return {
      word,
      last: k === words.length - 1,
      fill: clamp((progress - start) / Math.max(0.0001, end - start), 0, 1) * 100,
      lit: progress >= start,
    };
  });
}

export function LyricsPanel() {
  const p = usePlayer();
  const t = p.current;
  const id = t?.videoId ?? null;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const wraps = useRef([]);
  const lastUserScroll = useRef(0);
  const browseTimer = useRef(null);
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    setData(null);
    if (!id) return;
    let live = true;
    setLoading(true);
    fetch(`/api/lyrics/${id}`)
      .then((r) => r.json())
      .then((j) => live && setData(j))
      .catch(() => live && setData(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(
    () => () => {
      if (browseTimer.current) clearTimeout(browseTimer.current);
    },
    [],
  );

  const lines = useMemo(() => (data?.synced && data.text ? parseLrc(data.text) : []), [data]);

  const activeIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= p.position) idx = i;
      else break;
    }
    return idx;
  }, [lines, p.position]);

  const userMoved = useCallback(() => {
    lastUserScroll.current = Date.now();
    setBrowsing(true);
    if (browseTimer.current) clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => setBrowsing(false), 3200);
  }, []);

  const follow = useCallback((smooth = true) => {
    const sc = scrollRef.current;
    const el = wraps.current[activeIdx];
    if (!sc || !el || activeIdx < 0) return;
    sc.scrollTo({
      top: Math.max(0, el.offsetTop - sc.clientHeight * 0.3),
      behavior: smooth && !motionOff() ? "smooth" : "auto",
    });
    lastUserScroll.current = 0;
    setBrowsing(false);
  }, [activeIdx]);

  useEffect(() => {
    if (Date.now() - lastUserScroll.current < 3200) return;
    follow();
  }, [activeIdx, follow]);

  const plain = !data?.synced && data?.text ? data.text.split(/\r?\n/) : null;
  const status =
    data?.source === "lrclib"
      ? "Lirik sinkron · LRCLIB"
      : data?.source === "youtube-music"
        ? "Lirik · YouTube Music"
        : loading
          ? "Mencari lirik…"
          : "Tidak ada lirik";

  return (
    <div className="sl-root flex h-full min-h-0 flex-1 flex-col">
      <div className="sl-head flex shrink-0 items-center gap-3 px-5 pb-3 pt-1 lg:pt-4">
        <Artwork
          src={t?.thumbs}
          className="h-11 w-11 shrink-0 rounded-lg object-cover shadow-[var(--shadow-art)]"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-semibold leading-tight text-label1">{t?.title}</h2>
          <p className="truncate text-[13px] leading-tight text-label2" aria-live="polite">
            {status}
          </p>
        </div>
        <button
          onClick={() => p.toggleUi("lyrics")}
          className="glass-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill1 text-label1"
          aria-label="Tutup lirik"
        >
          <IconClose className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div
        ref={scrollRef}
        onWheel={userMoved}
        onTouchMove={userMoved}
        className="sl-scroll relative min-h-0 flex-1 overflow-y-auto px-5"
      >
        {loading && (
          <div className="sl-skeleton animate-pulse space-y-4 py-8" aria-hidden="true">
            <div className="h-8 w-4/5 rounded-lg bg-fill1" />
            <div className="h-8 w-3/5 rounded-lg bg-fill1" />
            <div className="h-8 w-2/3 rounded-lg bg-fill1" />
          </div>
        )}
        {!loading && !data?.text && (
          <p className="mt-16 text-center text-[15px] text-label2">
            Lirik tidak tersedia untuk lagu ini.
          </p>
        )}
        {!loading && lines.length > 0 && (
          <div key={id ?? "x"} className="sl-lyrics py-[12dvh] pb-[42dvh]">
            {lines.map((l, i) => {
              const active = i === activeIdx;
              const sung = activeIdx >= 0 && i < activeIdx;
              const dist = activeIdx < 0 ? 3 : Math.min(4, Math.abs(i - activeIdx));
              const dur = Math.max(0.6, (lines[i + 1]?.time ?? l.time + 5) - l.time);
              const prog = sung ? 1 : active ? clamp((p.position - l.time) / dur, 0, 1) : 0;
              const state = active ? "sl-active" : sung ? "sl-sung" : "sl-next";
              const fade = active || browsing ? 1 : [1, 0.58, 0.42, 0.3, 0.22][dist - 1];
              return (
                <div
                  key={i}
                  ref={(el) => {
                    wraps.current[i] = el;
                  }}
                  className={`sl-line ${state}`}
                  style={{ "--sl-fade": fade, "--sl-blur": active || browsing ? "0px" : `${[0, 0.5, 1.2, 1.8, 2.4][dist - 1]}px` }}
                >
                  <button
                    onClick={() => p.seek(l.time)}
                    aria-current={active ? "true" : undefined}
                    aria-label={l.text ? undefined : "Jeda instrumental"}
                    className="sl-lyric-btn block w-full origin-left rounded-xl px-2 py-1.5 text-left"
                  >
                    {l.text ? (
                      active ? (
                        wordSpans(l.text, prog).map((s, k) => (
                          <span
                            key={k}
                            className={`sl-word ${s.lit ? "lit" : ""}`}
                            style={{ "--sl-fill": `${s.fill}%` }}
                          >
                            {s.word}
                            {!s.last ? " " : ""}
                          </span>
                        ))
                      ) : (
                        <span className="sl-word sl-static">{l.text}</span>
                      )
                    ) : (
                      <span className={`sl-dots ${active ? "on" : ""}`} aria-hidden="true">
                        {[0, 1, 2].map((d) => (
                          <i key={d} style={{ opacity: active ? (prog * 3 > d ? 1 : 0.3) : 0.45 }} />
                        ))}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {!loading && plain && (
          <div className="sl-static-body whitespace-pre-wrap py-8 pb-28 text-[18px] font-medium leading-8 text-label1">
            {plain.join("\n")}
          </div>
        )}
      </div>

      <button
        onClick={() => follow()}
        className={`sl-back ${browsing && activeIdx >= 0 ? "visible" : ""}`}
        aria-label="Kembali ke lirik aktif"
        title="Kembali ke lirik aktif"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 12.5 10 7.5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <footer className="sl-credits shrink-0 px-5 pb-3 pt-1 text-[11px] leading-snug text-label2">
        Tampilan terinspirasi{" "}
        <a
          href="https://github.com/Spikerko/spicy-lyrics"
          onClick={(e) => {
            e.preventDefault();
            openExternal("https://github.com/Spikerko/spicy-lyrics");
          }}
        >
          Spicy Lyrics
        </a>{" "}
        · Spikerko (AGPL-3.0) · diterapkan ulang untuk Musiku (MIT)
      </footer>
    </div>
  );
}

export default LyricsPanel;
