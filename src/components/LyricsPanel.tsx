"use client";

import { usePlayer } from "@/lib/player";
import { IconClose } from "@/components/Icons";
import { Artwork } from "@/components/Artwork";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Lyrics as LyricsData } from "@/lib/types";

type LrcLine = { time: number; text: string };

export function parseLrc(raw: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const matches = [...(line?.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g) ?? [])];
    if (!matches.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    for (const m of matches) {
      const time = Number(m[1]) * 60 + Number(m[2]) + Number((m[3] ?? "0").padEnd(3, "0")) / 1000;
      out.push({ time, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

type RowProps = {
  line: LrcLine;
  index: number;
  active: boolean;
  dist: number;
  browsing: boolean;
  prog: number;
  immersive: boolean;
  wraps: { current: (HTMLDivElement | null)[] };
  seek: (time: number) => void;
};

// Baris di-memo: tick player cuma me-render baris aktif, bukan seluruh lirik.
const LyricRow = memo(function LyricRow({
  line,
  index,
  active,
  dist,
  browsing,
  prog,
  immersive,
  wraps,
  seek,
}: RowProps) {
  const words = line.text ? line.text.split(/\s+/) : [];
  const total = words.reduce((n, w) => n + w.length + 1, 0) || 1;
  let acc = 0;
  return (
    <div
      ref={(el) => {
        wraps.current[index] = el;
      }}
      className={immersive ? "lyric-in im-lyric-in" : "lyric-in will-change-transform"}
      data-far={immersive && dist >= 3 ? "1" : undefined}
      style={
        immersive
          ? ({
              "--dist": dist,
              willChange: dist <= 1 ? "transform, opacity, filter" : undefined,
            } as CSSProperties)
          : { animationDelay: `${Math.min(index, 10) * 45}ms` }
      }
    >
      <button
        onClick={() => seek(line.time)}
        aria-current={active ? "true" : undefined}
        aria-label={line.text ? undefined : "Jeda instrumental"}
        data-im={immersive ? "1" : undefined}
        data-interlude={!line.text ? "1" : undefined}
        className={
          immersive
            ? "im-lyric-line"
            : "block w-full origin-left rounded-xl px-2 py-2 text-left text-[28px] font-bold leading-[1.18] tracking-[-0.02em] text-label1 [@media(hover:hover)]:hover:!opacity-90 [@media(hover:hover)]:hover:![filter:none]"
        }
        style={
          immersive
            ? undefined
            : {
                opacity: active ? 1 : browsing ? 0.78 : [0.52, 0.4, 0.3][dist - 1],
                filter: active || browsing ? "none" : `blur(${[0.5, 1.2, 2][dist - 1]}px)`,
                transform: `scale(${active ? 1 : 0.92})`,
                transition:
                  "opacity 0.6s ease, filter 0.6s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
              }
        }
      >
        {line.text ? (
          active ? (
            words.map((w, k) => {
              const start = acc / total;
              acc += w.length + 1;
              const lit = prog >= start;
              return (
                <span
                  key={k}
                  className={immersive ? "im-lyric-word" : "transition-opacity duration-500 ease-out"}
                  style={{ opacity: lit ? 1 : 0.42 }}
                >
                  {w}
                  {k < words.length - 1 ? " " : ""}
                </span>
              );
            })
          ) : (
            line.text
          )
        ) : (
          <span
            className={`lyric-dots ${active ? "on" : ""}${immersive ? " im-dots" : ""}`}
            aria-hidden="true"
            style={immersive && active ? ({ "--p": prog } as CSSProperties) : undefined}
          >
            {[0, 1, 2].map((d) => (
              <i
                key={d}
                style={
                  immersive
                    ? ({ "--i": d } as CSSProperties)
                    : { opacity: active ? (prog * 3 > d ? 1 : 0.35) : 0.6 }
                }
              />
            ))}
          </span>
        )}
      </button>
    </div>
  );
});

export function LyricsPanel({ immersive = false }: { immersive?: boolean }) {
  const p = usePlayer();
  const t = p.current;
  const id = t?.videoId ?? null;
  const [data, setData] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const lastIdx = useRef(-2);

  useEffect(() => {
    setData(null);
    lastIdx.current = -2;
    if (!id) return;
    let live = true;
    setLoading(true);
    fetch(`/api/lyrics/${id}`)
      .then((r) => r.json())
      .then((j) => live && setData(j as LyricsData))
      .catch(() => live && setData(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);

  const lines = useMemo(() => (data?.synced && data.text ? parseLrc(data.text) : []), [data]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wraps = useRef<(HTMLDivElement | null)[]>([]);
  const lastUserScroll = useRef(0);
  const [browsing, setBrowsing] = useState(false);
  const browseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resumeTick, setResumeTick] = useState(0);
  const scrollTween = useRef<(() => void) | null>(null);
  const idleMs = immersive ? 3000 : 3500;

  // Referensi stabil: baris di-memo tidak ikut re-render tiap tick player.
  const seekRef = useRef(p.seek);
  seekRef.current = p.seek;
  const seek = useCallback((time: number) => seekRef.current(time), []);

  const userMoved = () => {
    lastUserScroll.current = Date.now();
    scrollTween.current?.();
    setBrowsing(true);
    if (browseTimer.current) clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => {
      setBrowsing(false);
      if (immersive) setResumeTick((n) => n + 1); // balik ke baris aktif setelah idle
    }, idleMs);
  };
  useEffect(
    () => () => {
      if (browseTimer.current) clearTimeout(browseTimer.current);
      scrollTween.current?.();
    },
    [],
  );

  const activeIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= p.position) idx = i;
      else break;
    }
    return idx;
  }, [lines, p.position]);

  /**
   * Follow the song the way Apple Music does: the scroll position jumps to the
   * new target at once, then every line eases from its old spot to the new one,
   * each starting a beat after the one above it, so the lyrics ripple upward.
   * Never fights someone who is reading ahead.
   *
   * Imersif memakai jalur terpisah: baris aktif di tengah, tween 560ms,
   * dan auto-scroll lanjut lagi 3 detik setelah user berhenti scroll.
   */
  useEffect(() => {
    const sc = scrollRef.current;
    const el = wraps.current[activeIdx];
    const prev = lastIdx.current;
    lastIdx.current = activeIdx;
    if (!sc || !el || activeIdx < 0) return;
    if (Date.now() - lastUserScroll.current < idleMs) return;
    const target = immersive
      ? Math.max(0, el.offsetTop + el.offsetHeight / 2 - sc.clientHeight / 2)
      : Math.max(0, el.offsetTop - sc.clientHeight * 0.32);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (immersive) {
      scrollTween.current?.();
      const from = sc.scrollTop;
      if (reduce || prev < 0 || Math.abs(target - from) > sc.clientHeight * 1.5) {
        sc.scrollTop = target; // lompatan besar / first line / reduce motion
        return;
      }
      const delta = target - from;
      const t0 = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / 560);
        const eased = 1 - Math.pow(1 - k, 4); // cubic-bezier(0.22, 1, 0.36, 1)
        sc.scrollTop = from + delta * eased;
        if (k < 1) raf = requestAnimationFrame(tick);
        else scrollTween.current = null;
      };
      raf = requestAnimationFrame(tick);
      scrollTween.current = () => cancelAnimationFrame(raf);
      return () => scrollTween.current?.();
    }

    const delta = target - sc.scrollTop;
    if (Math.abs(delta) < 1) return;
    if (reduce || prev < 0 || Math.abs(delta) > sc.clientHeight * 1.2) {
      sc.scrollTo({ top: target, behavior: "auto" });
      return;
    }
    sc.scrollTop = target;
    const near = (i: number) => i >= activeIdx - 6 && i <= activeIdx + 14;
    wraps.current.forEach((w, i) => {
      if (!w) return;
      w.style.transition = "none";
      w.style.transform = near(i) ? `translateY(${delta}px)` : "";
    });
    void sc.offsetHeight; // commit the starting positions
    wraps.current.forEach((w, i) => {
      if (!w || !near(i)) return;
      const after = Math.max(0, i - activeIdx);
      w.style.transition = `transform 680ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(after, 8) * 48}ms`;
      w.style.transform = "";
    });
  }, [activeIdx, immersive, idleMs, resumeTick]);

  const plain = !data?.synced && data?.text ? data.text.split(/\r?\n/) : null;
  const status =
    data?.source === "lrclib"
      ? "Lirik sinkron"
      : data?.source === "youtube-music"
        ? "Lirik · YouTube Music"
        : loading
          ? "Mencari lirik…"
          : "Tidak ada lirik";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Imersif: judul/artis sudah ada di .im-card, keluar pakai .im-exit. */}
      {!immersive && (
        <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1 lg:pt-4">
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
      )}

      <div
        ref={scrollRef}
        onWheel={userMoved}
        onTouchMove={userMoved}
        data-browsing={immersive && browsing ? "1" : undefined}
        className={
          immersive
            ? "im-lyrics-scroll relative min-h-0 flex-1 overflow-y-auto px-5"
            : "relative min-h-0 flex-1 overflow-y-auto px-5 [mask-image:linear-gradient(to_bottom,transparent,#000_6%,#000_90%,transparent)]"
        }
      >
        {loading && (
          <div className="animate-pulse space-y-4 py-8" aria-hidden="true">
            <div className="h-8 w-4/5 rounded-lg bg-fill1" />
            <div className="h-8 w-3/5 rounded-lg bg-fill1" />
            <div className="h-8 w-2/3 rounded-lg bg-fill1" />
          </div>
        )}
        {!loading && !data?.text && (
          <p className="mt-16 text-center text-[15px] text-label2">Lirik tidak tersedia untuk lagu ini.</p>
        )}
        {!loading && lines.length > 0 && (
          <div key={id ?? "x"} className={immersive ? "pt-[50dvh] pb-[46dvh]" : "pt-[10dvh] pb-[40dvh]"}>
            {lines.map((l, i) => {
              const active = i === activeIdx;
              const dist = activeIdx < 0 ? 3 : Math.min(3, Math.abs(i - activeIdx));
              const dur = Math.max(0.6, (lines[i + 1]?.time ?? l.time + 5) - l.time);
              const prog = active ? Math.min(1, Math.max(0, (p.position - l.time) / dur) / 0.85) : 0;
              return (
                <LyricRow
                  key={i}
                  line={l}
                  index={i}
                  active={active}
                  dist={dist}
                  browsing={browsing}
                  prog={prog}
                  immersive={immersive}
                  wraps={wraps}
                  seek={seek}
                />
              );
            })}
          </div>
        )}
        {!loading && plain && (
          <div className="whitespace-pre-wrap py-8 pb-28 text-[18px] font-medium leading-8 text-label1">
            {plain.join("\n")}
          </div>
        )}
      </div>
    </div>
  );
}
