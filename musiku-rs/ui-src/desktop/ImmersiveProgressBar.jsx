// Progress bar imersif: subscribe player, tapi menulis DOM lewat ref + rAF.
// Tidak ada setState per tick → ImmersiveLyrics tidak ikut re-render.
import { useCallback, useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player";

const fmt = (s) => {
  const n = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

// smoothReset dipakai Cover Flow supaya progress turun halus saat ganti lagu.
// Default false → perilaku ImmersiveLyrics persis seperti sebelumnya.
export function ImmersiveProgressBar({ smoothReset = false, resetMs = 350 }) {
  const p = usePlayer();
  const { duration, seek, playing, current } = p;
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const fillRef = useRef(null);
  const thumbRef = useRef(null);
  const curRef = useRef(null);
  const remRef = useRef(null);
  const anchor = useRef({ pos: p.position, ts: performance.now(), playing });
  const drag = useRef({ on: false, ratio: 0 });
  const shownSec = useRef(-1);
  const raf = useRef(0);
  const lastRatio = useRef(0);
  const reset = useRef({ active: false, from: 0, start: 0, ms: 0, lastId: null });
  const seekRef = useRef(seek);
  seekRef.current = seek;

  // Ganti lagu: mulai easing dari rasio terakhir ke 0, bukan loncat.
  useEffect(() => {
    if (!smoothReset) return;
    const id = current?.videoId ?? "";
    const r = reset.current;
    if (r.lastId === null) {
      r.lastId = id;
      return;
    }
    if (r.lastId === id) return;
    r.lastId = id;
    r.from = lastRatio.current;
    r.start = performance.now();
    r.ms = Math.max(1, resetMs);
    r.active = true;
  }, [current?.videoId, smoothReset, resetMs]);

  // timeupdate datang ~4x/detik; interpolasi antar event bikin bar tetap mulus.
  useEffect(() => {
    anchor.current = { pos: p.position, ts: performance.now(), playing };
  }, [p.position, playing]);

  const paint = useCallback(
    (now) => {
      const d = duration > 0 ? duration : 0;
      const a = anchor.current;
      let pos = a.playing ? a.pos + (now - a.ts) / 1000 : a.pos;
      if (d) pos = Math.min(d, Math.max(0, pos));
      if (drag.current.on) pos = drag.current.ratio * d;
      const ratio = d ? pos / d : 0;
      lastRatio.current = ratio;

      let drawn = ratio;
      if (smoothReset && reset.current.active) {
        const k = Math.min(1, (now - reset.current.start) / reset.current.ms);
        const eased = 1 - Math.pow(1 - k, 3);
        drawn = reset.current.from * (1 - eased);
        if (k >= 1) reset.current.active = false;
      }
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${drawn})`;
      if (thumbRef.current) thumbRef.current.style.left = `${drawn * 100}%`;

      const sec = Math.floor(pos);
      if (sec !== shownSec.current) {
        shownSec.current = sec;
        if (curRef.current) curRef.current.textContent = fmt(sec);
        if (remRef.current) remRef.current.textContent = d ? `-${fmt(Math.max(0, Math.ceil(d - pos)))}` : "0:00";
      }
      raf.current = requestAnimationFrame(paint);
    },
    [duration, smoothReset],
  );

  useEffect(() => {
    raf.current = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf.current);
  }, [paint]);

  const ratioAt = (clientX) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const onDown = (e) => {
    if (!duration) return;
    drag.current.on = true;
    drag.current.ratio = ratioAt(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (rootRef.current) rootRef.current.dataset.dragging = "1";
  };
  const onMove = (e) => {
    if (drag.current.on) drag.current.ratio = ratioAt(e.clientX);
  };
  const onUp = () => {
    if (!drag.current.on) return;
    const next = drag.current.ratio * duration;
    drag.current.on = false;
    if (rootRef.current) delete rootRef.current.dataset.dragging;
    seekRef.current(next);
    anchor.current = { pos: next, ts: performance.now(), playing };
  };
  const onKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = Math.min(duration || Infinity, Math.max(0, p.position + (e.key === "ArrowRight" ? 5 : -5)));
    seekRef.current(next);
    anchor.current = { pos: next, ts: performance.now(), playing };
  };

  return (
    <div
      ref={rootRef}
      className="im-progress"
      role="slider"
      tabIndex={0}
      aria-label="Posisi lagu"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(p.position)}
      aria-valuetext={`${fmt(p.position)} dari ${fmt(duration)}`}
      onKeyDown={onKey}
    >
      <div
        className="im-progress-hit"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div ref={trackRef} className="im-progress-track">
          <div ref={fillRef} className="im-progress-fill" />
          <span ref={thumbRef} className="im-progress-thumb" aria-hidden="true" />
        </div>
      </div>
      <div className="im-progress-time" aria-hidden="true">
        <span ref={curRef} />
        <span ref={remRef} />
      </div>
    </div>
  );
}
