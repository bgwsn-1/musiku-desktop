import { useEffect, useRef } from "react";
import { clamp, fillOf, motionOff, spansOf, writeLine, writeWord } from "./motion";

/** Animator Spicy untuk panel lirik desktop.
 *
 *  `timeupdate` cuma ~4x/detik. rAF membaca jam audio yang sama dengan player
 *  (getPosition() → HTMLAudioElement.currentTime) tiap frame, lalu menulis CSS
 *  variable langsung ke DOM. Tanpa prediksi dan tanpa re-render seluruh daftar
 *  lirik — itu yang membuat sapuan kata tetap mulus.
 *
 *  prefers-reduced-motion dicek tiap tick, jadi perubahan preferensi langsung
 *  dihormati tanpa perlu mount ulang komponen.
 */
export function useSpicyAnimator({ playerRef, linesRef, wrapsRef, onActiveChange }) {
  const activeRef = useRef(-1);

  useEffect(() => {
    let raf;
    const tick = () => {
      if (!motionOff()) {
        const now = playerRef.current.getPosition?.() ?? playerRef.current.position;
        const list = linesRef.current;
        if (Number.isFinite(now) && list.length) {
          let idx = -1;
          for (let i = 0; i < list.length; i++) {
            if (list[i].time <= now) idx = i;
            else break;
          }
          if (idx !== activeRef.current) {
            activeRef.current = idx;
            onActiveChange?.(idx);
          }

          const line = list[idx];
          const root = wrapsRef.current[idx];
          if (line && root) {
            const dur = Math.max(0.6, (list[idx + 1]?.time ?? line.time + 5) - line.time);
            const progress = clamp((now - line.time) / dur, 0, 1);
            const spans = spansOf(line.text);
            root.querySelectorAll(".sl-word").forEach((node, k) => {
              writeWord(node, fillOf(spans, k, progress));
            });
            writeLine(root, progress);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playerRef, linesRef, wrapsRef, onActiveChange]);
}
