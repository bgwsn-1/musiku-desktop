"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { IconMusic } from "@/components/Icons";

/**
 * Warna artwork lagu saat ini melebur ke seluruh jendela, di belakang kaca.
 *
 * Port dari LyricsBackgroundLayerView Apple Music Android 7.0.0 (dekompilasi):
 * artwork digambar TIGA lapis berotasi terus (120s/90s/70s, arah selang-
 * seling) dengan saturasi tinggi, RenderScript blur, lalu scrim.
 *
 * Pipeline performa (mengikuti cara Apple: blur di bitmap KECIL):
 * artwork di-downscale ke raster ~64px, DI-BLUR di canvas sekali per lagu,
 * hasilnya jadi <img> kecil yang di-upscale CSS — kompositor hanya
 * meng-upscale raster, TIDAK mem-blur. Perf guard Apple (3 frame >15ms →
 * animasi berhenti): rAF loop mengukur FPS saat artwork aktif; >35% frame
 * lambat → rotasi dibekukan permanen (module-level, kebal remount).
 */
// keputusan perf guard: module-level — kebal remount/ganti lagu
let perfOk = true;
const listeners = new Set<(v: boolean) => void>();

function setPerf(v: boolean) {
  perfOk = v;
  listeners.forEach((l) => l(v));
}

/** Pra-blur artwork di canvas kecil (blur murah) → data URL. */
function makeBlurred(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // downscale ke raster kecil (Apple: ÷24); blur 14px di sini
      const S = 64;
      const c = document.createElement("canvas");
      c.width = S;
      c.height = S;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.filter = "blur(14px) saturate(2.3)";
      // gambarkan lebih besar dari canvas biar tepi blur tidak transparan
      ctx.drawImage(img, -S * 0.25, -S * 0.25, S * 1.5, S * 1.5);
      try {
        resolve(c.toDataURL("image/jpeg", 0.8));
      } catch {
        resolve(null); // canvas tainted (CORS) → pakai asli
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function AmbientWindow() {
  const t = usePlayer().current;
  const [blurred, setBlurred] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0);
  const [perf, setPerfState] = useState(perfOk);

  useEffect(() => {
    listeners.add(setPerfState);
    return () => {
      listeners.delete(setPerfState);
    };
  }, []);

  const src = t?.thumbs ?? null;
  useEffect(() => {
    if (!src) {
      setBlurred(null);
      return;
    }
    let stale = false;
    setOpacity(0);
    makeBlurred(src).then((url) => {
      if (!stale) {
        setBlurred(url ?? src);
        setOpacity(1);
      }
    });
    return () => {
      stale = true;
    };
  }, [src]);

  // ---- perf guard: ukur FPS sekali saat artwork hidup ----
  const guardedRef = useRef(false);
  useEffect(() => {
    if (!src || !perfOk || guardedRef.current) return;
    let raf = 0;
    let frames = 0;
    let slow = 0;
    let last = 0;
    const start = performance.now() + 1500; // settle dulu
    const tick = (now: number) => {
      if (now < start) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!last) last = now;
      const dt = now - last;
      last = now;
      if (dt < 200) {
        frames++;
        if (dt > 20) slow++;
      }
      if (now - start < 2000 + 1500) {
        raf = requestAnimationFrame(tick);
        return;
      }
      guardedRef.current = true;
      if (frames > 20 && slow / frames > 0.35) setPerf(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src]);

  return (
    <div className="window-ambient" aria-hidden="true">
      <div className={`liquid-field ${perf ? "" : "liquid-off"}`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`liquid-layer liquid-${["a", "b", "c"][i]}`}
            style={{
              backgroundImage: blurred ? `url(${blurred})` : undefined,
              opacity,
              transition: "opacity 1.2s ease",
            }}
          >
            {src && !blurred && (
              <div className="liquid-fallback flex items-center justify-center">
                <IconMusic className="h-1/4 w-1/4 text-label3" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
