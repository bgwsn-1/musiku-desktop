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
  type TouchEvent as ReactTouchEvent,
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── Parameter gerak lirik imersif — semua knob ada di sini ────────────────
const LYRIC_MOTION = {
  /** Spring pengikut track. ζ ≈ 0.97 → overshoot < 0.1px, settle ~450–500ms. */
  stiffness: 240,
  damping: 30,
  /** Ombak baris: 16ms per jarak dari baris aktif, mentok di 4 baris. */
  staggerMs: 16,
  staggerMaxLines: 4,
  /** Baris yang ikut animasi ombak sejauh radius ini dari baris aktif. */
  waveRadiusLines: 6,
  /** Skala baris aktif; baris lain 1.0 (selisih 0.025). */
  activeScale: 1.025,
  /** Lompat jauh (seek / klik baris jauh): tween pendek, tanpa ombak. */
  jumpMs: 250,
  jumpViewports: 0.75,
  jumpLines: 6,
  /** Ambang snap: hentikan spring tanpa sisa gerakan sub-piksel. */
  snapPx: 0.6,
  snapVel: 24,
};

type Spring = { cur: number; target: number; vel: number; delay?: number };

function stepSpring(s: Spring, dt: number, k: number, c: number) {
  const a = -k * (s.cur - s.target) - c * s.vel;
  s.vel += a * dt;
  s.cur += s.vel * dt;
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
              "--im-scale-on": LYRIC_MOTION.activeScale,
              "--im-scale-delta": LYRIC_MOTION.activeScale - 1,
              willChange: dist <= 3 ? "transform, opacity" : undefined,
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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const wraps = useRef<(HTMLDivElement | null)[]>([]);
  const lastUserScroll = useRef(0);
  const touchY = useRef(0);
  const [browsing, setBrowsing] = useState(false);
  const browseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resumeTick, setResumeTick] = useState(0);
  const scrollTween = useRef<(() => void) | null>(null);
  const idleMs = immersive ? 3000 : 3500;

  // Imersif: posisi dihitung per frame lalu dipakai sbg translate3d, bukan scrollTop.
  const motion = useRef<{
    pos: Spring;
    tween: { from: number; to: number; t0: number; dur: number } | null;
    lines: Map<number, Spring>;
    raf: number;
    last: number;
  }>({
    pos: { cur: 0, target: 0, vel: 0 },
    tween: null,
    lines: new Map(),
    raf: 0,
    last: 0,
  });

  const runSpring = useCallback((now: number) => {
    const m = motion.current;
    const dt = Math.min(0.032, Math.max(0.001, (now - (m.last || now)) / 1000));
    m.last = now;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      m.pos.cur = m.pos.target;
      m.pos.vel = 0;
      m.tween = null;
      if (trackRef.current) trackRef.current.style.transform = `translate3d(0, ${m.pos.cur}px, 0)`;
      m.lines.forEach((_s, i) => {
        const w = wraps.current[i];
        if (w) w.style.transform = "";
      });
      m.lines.clear();
      m.raf = 0;
      return;
    }

    let alive = false;
    if (m.tween) {
      // Lompat jauh: satu tween ease-out tanpa overshoot, bukan spring berombak.
      const k = Math.min(1, (now - m.tween.t0) / m.tween.dur);
      const eased = 1 - Math.pow(1 - k, 3);
      m.pos.cur = m.tween.from + (m.tween.to - m.tween.from) * eased;
      m.pos.vel = 0;
      if (k >= 1) {
        m.pos.cur = m.pos.target;
        m.tween = null;
      } else alive = true;
    } else {
      stepSpring(m.pos, dt, LYRIC_MOTION.stiffness, LYRIC_MOTION.damping);
      const done =
        Math.abs(m.pos.target - m.pos.cur) <= LYRIC_MOTION.snapPx &&
        Math.abs(m.pos.vel) <= LYRIC_MOTION.snapVel;
      if (done) {
        m.pos.cur = m.pos.target;
        m.pos.vel = 0;
      } else alive = true;
    }
    if (trackRef.current) trackRef.current.style.transform = `translate3d(0, ${m.pos.cur}px, 0)`;

    m.lines.forEach((s, i) => {
      if (s.delay && s.delay > 0) {
        s.delay -= dt * 1000;
        alive = true;
        return;
      }
      stepSpring(s, dt, LYRIC_MOTION.stiffness, LYRIC_MOTION.damping);
      const w = wraps.current[i];
      if (Math.abs(s.cur) <= LYRIC_MOTION.snapPx && Math.abs(s.vel) <= LYRIC_MOTION.snapVel) {
        if (w) w.style.transform = "";
        m.lines.delete(i);
        return;
      }
      if (w) w.style.transform = `translate3d(0, ${s.cur}px, 0)`;
      alive = true;
    });

    if (alive) m.raf = requestAnimationFrame(runSpring);
    else {
      m.raf = 0;
      m.last = 0;
    }
  }, []);

  const startSpring = useCallback(() => {
    const m = motion.current;
    if (!m.raf) {
      m.last = 0;
      m.raf = requestAnimationFrame(runSpring);
    }
  }, [runSpring]);

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

  const browseBy = (dy: number) => {
    userMoved();
    if (!immersive) return; // layout lain tetap memakai scroll native
    const sc = scrollRef.current;
    const tr = trackRef.current;
    if (!sc || !tr) return;
    const m = motion.current;
    m.tween = null;
    m.lines.clear();
    wraps.current.forEach((w) => {
      if (w) w.style.transform = "";
    });
    const next = clamp(m.pos.target - dy, sc.clientHeight - tr.offsetHeight, 0);
    m.pos.target = next;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      m.pos.cur = next;
      m.pos.vel = 0;
      tr.style.transform = `translate3d(0, ${next}px, 0)`;
    } else startSpring();
  };
  const onTouchStart = (e: ReactTouchEvent) => {
    touchY.current = e.touches[0]?.clientY ?? 0;
    if (immersive) userMoved();
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    const y = e.touches[0]?.clientY ?? 0;
    browseBy(y - touchY.current);
    touchY.current = y;
  };

  useEffect(
    () => () => {
      if (browseTimer.current) clearTimeout(browseTimer.current);
      scrollTween.current?.();
      if (motion.current.raf) cancelAnimationFrame(motion.current.raf);
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
   * Imersif memakai jalur terpisah: track digeser translate3d oleh spring
   * (baris aktif di tengah, stagger ombak), dan lanjut lagi 3 detik setelah
   * user berhenti scroll. Layout lain tetap memakai scrollTop + ripple lama.
   */
  useEffect(() => {
    const sc = scrollRef.current;
    const el = wraps.current[activeIdx];
    const prev = lastIdx.current;
    lastIdx.current = activeIdx;
    if (!sc || !el || activeIdx < 0) return;
    // Kurangi 100ms supaya timer idle 3000ms tidak kalah race dengan guard ini.
    if (Date.now() - lastUserScroll.current < idleMs - 100) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (immersive) {
      const tr = trackRef.current;
      if (!tr) return;
      const m = motion.current;
      const target = clamp(
        sc.clientHeight / 2 - (el.offsetTop + el.offsetHeight / 2),
        sc.clientHeight - tr.offsetHeight,
        0,
      );
      const delta = target - m.pos.target;
      const far =
        Math.abs(delta) > sc.clientHeight * LYRIC_MOTION.jumpViewports ||
        Math.abs(activeIdx - prev) > LYRIC_MOTION.jumpLines;
      m.pos.target = target;
      m.lines.clear();
      wraps.current.forEach((w) => {
        if (w) w.style.transform = "";
      });
      if (reduce || prev < 0) {
        m.pos.cur = target;
        m.pos.vel = 0;
        m.tween = null;
        tr.style.transform = `translate3d(0, ${target}px, 0)`;
        return;
      }
      if (far) {
        // Seek / klik baris jauh: gelindingan pendek 250ms, tanpa ombak per baris.
        m.tween = { from: m.pos.cur, to: target, t0: performance.now(), dur: LYRIC_MOTION.jumpMs };
        m.pos.vel = 0;
        startSpring();
        return;
      }
      m.tween = null;
      // Ombak: baris sekitar aktif mulai di posisi lama lalu spring menyusul.
      const radius = LYRIC_MOTION.waveRadiusLines;
      for (let i = Math.max(0, activeIdx - radius); i <= Math.min(lines.length - 1, activeIdx + radius); i++) {
        m.lines.set(i, {
          cur: -delta,
          target: 0,
          vel: 0,
          delay:
            Math.min(Math.abs(i - activeIdx), LYRIC_MOTION.staggerMaxLines) * LYRIC_MOTION.staggerMs,
        });
      }
      startSpring();
      return;
    }

    const target = Math.max(0, el.offsetTop - sc.clientHeight * 0.32);
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

  const list = !loading && lines.length > 0 && (
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
  );

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
        onWheel={(e) => browseBy(e.deltaY)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        data-browsing={immersive && browsing ? "1" : undefined}
        className={
          immersive
            ? "im-lyrics-scroll relative min-h-0 flex-1 overflow-hidden px-5"
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
        {immersive ? <div ref={trackRef} className="im-lyrics-track relative">{list}</div> : list}
        {!loading && plain && (
          <div className="whitespace-pre-wrap py-8 pb-28 text-[18px] font-medium leading-8 text-label1">
            {plain.join("\n")}
          </div>
        )}
      </div>
    </div>
  );
}
