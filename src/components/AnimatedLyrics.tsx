"use client";

/**
 * Renderer lirik gaya “Spicy” milik Musiku.
 *
 * Ditulis ulang dari nol berdasarkan konsep spring + spline + style batching;
 * bukan salinan kode repo mana pun. Data kata ber-waktu pseudo berasal dari
 * LRC level baris (lihat lib/lyrics-anim/timing.ts).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { AnimSpline, clamp, cubicBezier } from "@/lib/lyrics-anim/easing";
import { Spring } from "@/lib/lyrics-anim/spring";
import { buildTimedLines } from "@/lib/lyrics-anim/timing";

const SCALE_CURVE = new AnimSpline([
  { t: 0, v: 0.95 },
  { t: 0.7, v: 1.0505 },
  { t: 1, v: 1 },
]);
const GLOW_CURVE = new AnimSpline([
  { t: 0, v: 0 },
  { t: 0.15, v: 1 },
  { t: 0.6, v: 1 },
  { t: 1, v: 0 },
]);
const Y_CURVE = new AnimSpline([
  { t: 0, v: 0.01 },
  { t: 0.9, v: -0.01667 },
  { t: 1, v: 0 },
]);

const USER_SCROLL_COOLDOWN_MS = 1200;
const EASE_OUT = cubicBezier(0.22, 1, 0.36, 1);

interface Glide {
  from: number;
  to: number;
  start: number;
  dur: number;
}

/** Target scroll berbasis posisi: bergerak mulus melewati baris, bukan melompat. */
function desiredScroll(
  pos: number,
  timed: { time: number; end: number }[],
  sc: HTMLDivElement,
  lineEls: Map<number, HTMLDivElement>,
): number {
  let active = -1;
  for (let i = 0; i < timed.length; i++) {
    if (timed[i].time <= pos) active = i;
    else break;
  }
  if (active < 0) return 0;
  const el = lineEls.get(active);
  if (!el) return 0;
  const line = timed[active];
  const pct = clamp((pos - line.time) / Math.max(0.05, line.end - line.time));
  const next = lineEls.get(active + 1);
  const base =
    el.offsetTop + (next ? (next.offsetTop - el.offsetTop) * EASE_OUT(pct) * 0.9 : 0);
  return Math.max(0, base - sc.clientHeight * 0.32);
}

type Status = -1 | 0 | 1; // −1 belum nyanyi, 0 aktif, 1 selesai

interface LineAnim {
  status: Status;
  springs: { scale: Spring; y: Spring; glow: Spring }[];
}

interface Props {
  lines: { time: number; text: string }[];
}

export function AnimatedLyrics({ lines }: Props) {
  const p = usePlayer();
  const timed = useMemo(() => buildTimedLines(lines), [lines]);
  const pRef = useRef(p);
  useEffect(() => {
    pRef.current = p;
  }, [p]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineEls = useRef(new Map<number, HTMLDivElement>());
  const btnEls = useRef(new Map<number, HTMLButtonElement>());
  const wordEls = useRef(new Map<string, HTMLSpanElement>());
  const anims = useRef<LineAnim[]>([]);
  const styleCache = useRef(new WeakMap<Element, Map<string, string>>());
  const pending = useRef(new Map<HTMLElement, Record<string, string>>());
  const userScrollAt = useRef(0);
  const posState = useRef({ target: 0, smooth: 0 });
  const prevActive = useRef(-1);
  const glide = useRef<Glide | null>(null);
  const [jumpVisible, setJumpVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    posState.current.target = p.position;
    posState.current.smooth = p.position;
  }, [p.position]);

  // Bangun ulang state animasi setiap kali lirik berganti.
  useEffect(() => {
    lineEls.current.clear();
    btnEls.current.clear();
    wordEls.current.clear();
    anims.current = timed.map((line) => ({
      status: -1 as Status,
      springs: line.words.map(() => ({
        scale: new Spring(0.95, { frequency: 0.9, damping: 0.64 }),
        y: new Spring(0.01, { frequency: 1.45, damping: 0.4 }),
        glow: new Spring(0, { frequency: 1.2, damping: 0.56 }),
      })),
    }));
    prevActive.current = -1;
  }, [timed]);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();

    const queueStyle = (el: HTMLElement, prop: string, value: string) => {
      let cache = styleCache.current.get(el);
      if (!cache) {
        cache = new Map();
        styleCache.current.set(el, cache);
      }
      const old = cache.get(prop);
      if (old !== undefined && Number(old) === Number(value)) return;
      cache.set(prop, value);
      let batch = pending.current.get(el);
      if (!batch) {
        batch = {};
        pending.current.set(el, batch);
      }
      batch[prop] = value;
    };

    const flush = () => {
      pending.current.forEach((styles, el) => {
        for (const [prop, value] of Object.entries(styles)) {
          el.style.setProperty(prop, value);
        }
      });
      pending.current.clear();
    };

    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const st = posState.current;
      const player = pRef.current;
      const chase = 1 - Math.exp(-dt * 14);
      st.smooth += (st.target - st.smooth) * chase;
      if (Math.abs(st.target - st.smooth) > 1.6 || !Number.isFinite(st.smooth)) {
        st.smooth = st.target;
      }
      const pos = clamp(st.smooth, 0, Math.max(player.duration || 0, st.target));

      const total = timed.length;
      let active = -1;
      for (let i = 0; i < total; i++) {
        if (timed[i].time <= pos) active = i;
        else break;
      }

      if (active < prevActive.current) {
        // mundur/seek: kata kembali ke posisi istirahat
        anims.current.forEach((a) =>
          a.springs.forEach((s) => {
            s.scale.Snap(0.95);
            s.y.Snap(0.01);
            s.glow.Snap(0);
          }),
        );
      }
      prevActive.current = active;

      for (let i = Math.max(0, active - 6); i < Math.min(total, active + 9); i++) {
        const a = anims.current[i];
        const el = lineEls.current.get(i);
        if (!a || !el) continue;
        const status: Status = i < active ? 1 : i === active ? 0 : -1;
        if (status !== a.status) {
          a.status = status;
          el.setAttribute("data-status", String(status));
          if (status === 0) el.classList.add("sl-live");
          else el.classList.remove("sl-live");
        }
        const dist = active < 0 ? 3 : Math.abs(i - active);
        queueStyle(
          el,
          "--sl-blur",
          dist === 0 ? "0px" : dist <= 2 ? "0.5px" : dist <= 4 ? "1.3px" : "2px",
        );
      }

      const act = active >= 0 ? anims.current[active] : undefined;
      if (act) {
        const line = timed[active];
        for (let w = 0; w < line.words.length; w++) {
          const word = line.words[w];
          const sp = act.springs[w];
          const pct = clamp((pos - word.start) / Math.max(0.05, word.end - word.start));
          sp.scale.SetGoal(SCALE_CURVE.at(pct));
          sp.y.SetGoal(Y_CURVE.at(pct));
          sp.glow.SetGoal(GLOW_CURVE.at(pct));
          sp.scale.Step(dt);
          sp.y.Step(dt);
          sp.glow.Step(dt);
          const el = wordEls.current.get(`${active}:${w}`);
          if (el) {
            queueStyle(el, "--sl-scale", sp.scale.value.toFixed(4));
            queueStyle(el, "--sl-y", `${sp.y.value.toFixed(5)}em`);
            queueStyle(el, "--sl-glow", sp.glow.value.toFixed(3));
          }
        }
      }
      flush();

      const sc = containerRef.current;
      if (sc) {
        const target = desiredScroll(pos, timed, sc, lineEls.current);
        const g = glide.current;
        if (g) {
          const k = clamp((now - g.start) / g.dur, 0, 1);
          sc.scrollTop = g.from + (g.to - g.from) * EASE_OUT(k);
          if (k >= 1) glide.current = null;
        } else if (now - userScrollAt.current > USER_SCROLL_COOLDOWN_MS) {
          const delta = target - sc.scrollTop;
          if (Math.abs(delta) > 0.6) {
            sc.scrollTop += delta * Math.min(1, dt * 5);
          }
        }
        const visible =
          Math.abs(target - sc.scrollTop) > sc.clientHeight * 0.45;
        setJumpVisible((v) => (v === visible ? v : visible));
      }
    };

    const tick = () => {
      try {
        step();
      } catch (err) {
        // Jangan biarkan satu frame error membunuh loop selamanya.
        console.warn("[AnimatedLyrics] frame error:", err);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timed, reduced]);

  // Mode reduced motion: tanpa spring; status & scroll diperbarui diskrit.
  useEffect(() => {
    if (!reduced) return;
    const pos = p.position;
    let active = -1;
    for (let i = 0; i < timed.length; i++) {
      if (timed[i].time <= pos) active = i;
      else break;
    }
    anims.current.forEach((a, i) => {
      const el = lineEls.current.get(i);
      if (!el) return;
      const status: Status = i < active ? 1 : i === active ? 0 : -1;
      a.status = status;
      el.setAttribute("data-status", String(status));
    });
    const sc = containerRef.current;
    const el = active >= 0 ? lineEls.current.get(active) : null;
    if (sc && el && performance.now() - userScrollAt.current > USER_SCROLL_COOLDOWN_MS) {
      sc.scrollTop = desiredScroll(pos, timed, sc, lineEls.current);
    }
  }, [p.position, timed, reduced]);

  const jumpToActive = () => {
    const sc = containerRef.current;
    if (!sc) return;
    const target = desiredScroll(
      posState.current.smooth,
      timed,
      sc,
      lineEls.current,
    );
    glide.current = {
          from: sc.scrollTop,
          to: target,
          start: performance.now(),
          dur: 520,
        };
        userScrollAt.current = performance.now();
      };

      const onUserScroll = () => {
        userScrollAt.current = performance.now();
      };

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        onWheel={onUserScroll}
        onTouchMove={onUserScroll}
        className="sl-scroll [mask-image:linear-gradient(to_bottom,transparent,#000_6%,#000_90%,transparent)]"
      >
      <div className="sl-inner">
        {timed.map((line, i) => (
          <div
            key={`${line.time}-${i}`}
            ref={(el) => {
              if (el) lineEls.current.set(i, el);
              else lineEls.current.delete(i);
            }}
            data-status={"-1"}
            className="sl-line"
          >
            <button
              ref={(el) => {
                if (el) btnEls.current.set(i, el);
                else btnEls.current.delete(i);
              }}
              onClick={() => p.seek(line.time)}
              aria-label={line.text ? undefined : "Jeda instrumental"}
              className="sl-word-btn"
            >
              {line.instrumental ? (
                <span className="lyric-dots" aria-hidden="true">
                  {[0, 1, 2].map((d) => (
                    <i key={d} />
                  ))}
                </span>
              ) : (
                line.words.map((w, k) => (
                  <span
                    key={k}
                    ref={(el) => {
                      if (el) wordEls.current.set(`${i}:${k}`, el);
                      else wordEls.current.delete(`${i}:${k}`);
                    }}
                    className="sl-word"
                  >
                    {w.text}
                    {k < line.words.length - 1 ? " " : ""}
                  </span>
                ))
              )}
            </button>
          </div>
        ))}
      </div>
      </div>
      {jumpVisible && (
        <button
          onClick={jumpToActive}
          className="glass-btn absolute bottom-4 right-4 z-10 rounded-full bg-fill1 px-4 py-2 text-[13px] font-medium text-label1 shadow-lg"
          aria-label="Kembali ke baris aktif"
        >
          Ke baris aktif
        </button>
      )}
    </div>
  );
}
