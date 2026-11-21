// Tampilan lirik terinspirasi Spicy Lyrics (github.com/Spikerko/spicy-lyrics).
// Implementasi ulang untuk Musiku: tetap MIT, tanpa menyalin kode AGPL repo itu.
// Hanya dipakai bundle desktop lewat alias `@/components/LyricsPanel`.
//
// Modul dipecah per tanggung jawab:
//   lyrics/lrc.js            → parse LRC, estimasi baris, teks status
//   lyrics/motion.js         → matematika sapuan kata + penulisan CSS variable
//   lyrics/useSpicyAnimator  → loop rAF yang membaca jam audio asli
//   lyrics/SpicyLine.jsx     → render satu baris / kata / jeda instrumental
//   spicy-lyrics.css         → gaya Spicy (base, motion, aksesibilitas)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { Artwork } from "@/components/Artwork";
import { IconClose } from "@/components/Icons";
import { buildLyrics, lyricsStatus } from "./lyrics/lrc";
import { motionOff } from "./lyrics/motion";
import { SpicyLine } from "./lyrics/SpicyLine";
import { useSpicyAnimator } from "./lyrics/useSpicyAnimator";

// NowPlaying.tsx (web source yang dipakai ulang bundle desktop) mengimpor
// parseLrc lewat alias `@/components/LyricsPanel`. Jaga kontrak itu tetap ada.
export { parseLrc } from "./lyrics/lrc";

function openExternal(url) {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (invoke) {
    void invoke("open_external", { url }).catch(() =>
      window.open(url, "_blank", "noopener,noreferrer"),
    );
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
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
    wraps.current = [];
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

  const { lines, estimated, plain } = useMemo(
    () => buildLyrics(data, p.duration),
    [data, p.duration],
  );
  const status = lyricsStatus(data, loading, estimated);

  // Baris aktif dihitung rAF dari jam audio yang sama dengan animator, supaya
  // tidak tertinggal sampai event timeupdate berikutnya.
  const [activeIdx, setActiveIdx] = useState(-1);
  const playerRef = useRef(p);
  playerRef.current = p;
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const handleActive = useCallback((idx) => setActiveIdx(idx), []);
  const registerLine = useCallback((i, el) => {
    wraps.current[i] = el;
  }, []);
  useSpicyAnimator({ playerRef, linesRef, wrapsRef: wraps, onActiveChange: handleActive });

  const userMoved = useCallback(() => {
    lastUserScroll.current = Date.now();
    setBrowsing(true);
    if (browseTimer.current) clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => setBrowsing(false), 3200);
  }, []);

  const follow = useCallback(
    (smooth = true) => {
      const sc = scrollRef.current;
      const el = wraps.current[activeIdx];
      if (!sc || !el || activeIdx < 0) return;
      sc.scrollTo({
        top: Math.max(0, el.offsetTop - sc.clientHeight * 0.32),
        behavior: smooth && !motionOff() ? "smooth" : "auto",
      });
      lastUserScroll.current = 0;
      setBrowsing(false);
    },
    [activeIdx],
  );

  useEffect(() => {
    if (Date.now() - lastUserScroll.current < 3200) return;
    follow();
  }, [activeIdx, follow]);

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
          <div key={id ?? "x"} className="sl-lyrics py-[14dvh] pb-[44dvh]">
            {lines.map((l, i) => (
              <SpicyLine
                key={i}
                line={l}
                i={i}
                activeIdx={activeIdx}
                browsing={browsing}
                onSeek={p.seek}
                registerRef={registerLine}
              />
            ))}
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
          <path
            d="M5 12.5 10 7.5l5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
