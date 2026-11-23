// Posisi carousel dihitung per frame dan ditulis langsung ke DOM via ref.
// Tidak ada setState per frame → queue/aurora/kontrol tidak ikut re-render.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { CF_LAYOUT, CF_MOTION, clamp, coverTransform } from "./coverFlowMath";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useCoverFlowMotion(count) {
  const els = useRef(new Map());
  const pos = useRef(0);
  const target = useRef(0);
  const vel = useRef(0);
  const tween = useRef(null);
  const raf = useRef(0);
  const last = useRef(0);
  const dragging = useRef(false);

  const paint = useCallback((value) => {
    const isReduced = reduced();
    els.current.forEach((el, i) => {
      if (!el) return;
      const s = coverTransform(i - value, isReduced);
      el.style.transform = s.transform;
      el.style.opacity = String(s.opacity);
      el.style.zIndex = String(s.zIndex);
      el.style.willChange = Math.abs(i - value) <= 2.5 ? "transform, opacity" : "auto";
    });
  }, []);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    last.current = 0;
  }, []);

  const step = useCallback(
    (now) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - (last.current || now)) / 1000));
      last.current = now;
      let alive = false;

      if (tween.current) {
        const k = Math.min(1, (now - tween.current.t0) / CF_MOTION.jumpMs);
        const eased = 1 - Math.pow(1 - k, 3);
        pos.current = tween.current.from + (tween.current.to - tween.current.from) * eased;
        if (k >= 1) {
          pos.current = target.current;
          tween.current = null;
        } else alive = true;
      } else {
        const a =
          -CF_MOTION.stiffness * (pos.current - target.current) - CF_MOTION.damping * vel.current;
        vel.current += a * dt;
        pos.current += vel.current * dt;
        if (
          Math.abs(pos.current - target.current) <= CF_MOTION.snapPx &&
          Math.abs(vel.current) <= CF_MOTION.snapVel
        ) {
          pos.current = target.current;
          vel.current = 0;
        } else alive = true;
      }

      paint(pos.current);
      if (alive) raf.current = requestAnimationFrame(step);
      else {
        raf.current = 0;
        last.current = 0;
      }
    },
    [paint],
  );

  const start = useCallback(() => {
    if (!raf.current) {
      last.current = 0;
      raf.current = requestAnimationFrame(step);
    }
  }, [step]);

  const register = useCallback((i, el) => {
    if (el) els.current.set(i, el);
    else els.current.delete(i);
  }, []);

  /** Dipanggil setelah render: melukis elemen yang baru masuk jendela render. */
  const sync = useCallback(() => paint(pos.current), [paint]);

  const goTo = useCallback(
    (i) => {
      const next = clamp(i, 0, Math.max(0, count - 1));
      target.current = next;
      vel.current = 0;
      if (reduced()) {
        stop();
        tween.current = null;
        pos.current = next;
        paint(next);
        return;
      }
      tween.current =
        Math.abs(next - pos.current) > CF_LAYOUT.jumpDistance
          ? { from: pos.current, to: next, t0: performance.now() }
          : null;
      start();
    },
    [count, paint, start, stop],
  );

  /** Selama drag: menulis posisi langsung, menghentikan animasi berjalan. */
  const setPos = useCallback(
    (value) => {
      stop();
      tween.current = null;
      pos.current = clamp(value, 0, Math.max(0, count - 1));
      target.current = pos.current;
      vel.current = 0;
      paint(pos.current);
    },
    [count, paint, stop],
  );

  useEffect(() => stop, [stop]);

  return useMemo(
    () => ({ register, sync, goTo, setPos, pos, dragging, stop }),
    [register, sync, goTo, setPos, stop],
  );
}
