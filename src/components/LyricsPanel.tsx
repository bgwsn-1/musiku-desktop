"use client";

import { usePlayer } from "@/lib/player";
import { IconClose, IconExpand } from "@/components/Icons";
import { Artwork } from "@/components/Artwork";
import { isDesktopClient, openLyricsPopout } from "@/lib/lyrics-popout";
import { useEffect, useMemo, useRef, useState } from "react";
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

export function LyricsPanel() {
  const p = usePlayer();
  const t = p.current;
  const id = t?.videoId ?? null;
  const [data, setData] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const lastIdx = useRef(-2);

  useEffect(() => setDesktop(isDesktopClient()), []);

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

  const userMoved = () => {
    lastUserScroll.current = Date.now();
    setBrowsing(true);
    if (browseTimer.current) clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => setBrowsing(false), 3500);
  };
  useEffect(
    () => () => {
      if (browseTimer.current) clearTimeout(browseTimer.current);
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
   */
  useEffect(() => {
    const sc = scrollRef.current;
    const el = wraps.current[activeIdx];
    const prev = lastIdx.current;
    lastIdx.current = activeIdx;
    if (!sc || !el || activeIdx < 0) return;
    if (Date.now() - lastUserScroll.current < 3500) return;
    const target = Math.max(0, el.offsetTop - sc.clientHeight * 0.32);
    const delta = target - sc.scrollTop;
    if (Math.abs(delta) < 1) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  }, [activeIdx]);

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
        {desktop && (
          <button
            onClick={() => openLyricsPopout()}
            className="glass-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill1 text-label1"
            aria-label="Buka lirik mengambang"
            title="Buka lirik mengambang"
          >
            <IconExpand className="h-[18px] w-[18px]" />
          </button>
        )}
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
        className="relative min-h-0 flex-1 overflow-y-auto px-5 [mask-image:linear-gradient(to_bottom,transparent,#000_6%,#000_90%,transparent)]"
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
          <div key={id ?? "x"} className="pt-[10dvh] pb-[40dvh]">
            {lines.map((l, i) => {
              const active = i === activeIdx;
              const dist = activeIdx < 0 ? 3 : Math.min(3, Math.abs(i - activeIdx));
              const dur = Math.max(0.6, (lines[i + 1]?.time ?? l.time + 5) - l.time);
              const prog = active ? Math.min(1, Math.max(0, (p.position - l.time) / dur) / 0.85) : 0;
              const words = l.text ? l.text.split(/\s+/) : [];
              const total = words.reduce((n, w) => n + w.length + 1, 0) || 1;
              let acc = 0;
              return (
                <div
                  key={i}
                  ref={(el) => {
                    wraps.current[i] = el;
                  }}
                  className="lyric-in will-change-transform"
                  style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
                >
                  <button
                    onClick={() => p.seek(l.time)}
                    aria-current={active ? "true" : undefined}
                    aria-label={l.text ? undefined : "Jeda instrumental"}
                    className="block w-full origin-left rounded-xl px-2 py-2 text-left text-[28px] font-bold leading-[1.18] tracking-[-0.02em] text-label1 [@media(hover:hover)]:hover:!opacity-90 [@media(hover:hover)]:hover:![filter:none]"
                    style={{
                      opacity: active ? 1 : browsing ? 0.78 : [0.52, 0.4, 0.3][dist - 1],
                      filter: active || browsing ? "none" : `blur(${[0.5, 1.2, 2][dist - 1]}px)`,
                      transform: `scale(${active ? 1 : 0.92})`,
                      transition:
                        "opacity 0.6s ease, filter 0.6s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    {l.text ? (
                      active ? (
                        words.map((w, k) => {
                          const start = acc / total;
                          acc += w.length + 1;
                          const lit = prog >= start;
                          return (
                            <span
                              key={k}
                              className="transition-opacity duration-500 ease-out"
                              style={{ opacity: lit ? 1 : 0.42 }}
                            >
                              {w}
                              {k < words.length - 1 ? " " : ""}
                            </span>
                          );
                        })
                      ) : (
                        l.text
                      )
                    ) : (
                      <span className={`lyric-dots ${active ? "on" : ""}`} aria-hidden="true">
                        {[0, 1, 2].map((d) => (
                          <i key={d} style={{ opacity: active ? (prog * 3 > d ? 1 : 0.35) : 0.6 }} />
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
          <div className="whitespace-pre-wrap py-8 pb-28 text-[18px] font-medium leading-8 text-label1">
            {plain.join("\n")}
          </div>
        )}
      </div>
    </div>
  );
}
