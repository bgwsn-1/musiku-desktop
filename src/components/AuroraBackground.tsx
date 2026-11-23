"use client";

/**
 * Latar aurora/mesh untuk layout imersif.
 *
 * - Hanya dipasang di dalam container imersif (absolute inset-0), bukan body.
 * - Pause otomatis saat container tak terlihat / dokumen hidden (minimize).
 * - Warna --c1..--c4 didaftarkan lewat @property <color> supaya crossfade
 *   ~1,5 detik saat ganti lagu.
 * - Palet diekstrak dari cover album (lib/aurora-palette).
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { AURORA_FALLBACK, extractPalette } from "@/lib/aurora-palette";

export interface AuroraHandle {
  /** Panggil tiap ganti lagu (atau saat palet perlu diperbarui). */
  setCover: (url: string | null | undefined) => void;
}

export const AuroraBackground = forwardRef<AuroraHandle>(
  function AuroraBackground(_props, ref) {
    const root = useRef<HTMLDivElement | null>(null);
    const currentUrl = useRef<string | null | undefined>(null);
    const seq = useRef(0);

    const apply = async (url: string | null | undefined, id: number) => {
      const el = root.current;
      if (!el) return;
      const colors = url ? await extractPalette(url) : [...AURORA_FALLBACK];
      if (id !== seq.current) return; // ganti lagu cepat: hasil lama dibuang
      for (let i = 0; i < 4; i++) {
        el.style.setProperty(`--c${i + 1}`, colors[i] ?? AURORA_FALLBACK[i]);
      }
    };

    useImperativeHandle(ref, () => ({
      setCover: (url) => {
        if (currentUrl.current === url) return;
        currentUrl.current = url;
        const id = ++seq.current;
        void apply(url, id);
      },
    }));

    // Hemat CPU/GPU: hentikan animasi saat layout tak terlihat / window minimized.
    useEffect(() => {
      const el = root.current;
      if (!el) return;
      const sync = () => {
        const paused =
          document.visibilityState === "hidden" ||
          !el.isConnected ||
          el.getClientRects().length === 0;
        el.dataset.paused = paused ? "1" : "";
      };
      const io = new IntersectionObserver(sync);
      io.observe(el);
      document.addEventListener("visibilitychange", sync);
      window.addEventListener("blur", sync);
      window.addEventListener("focus", sync);
      sync();
      return () => {
        io.disconnect();
        document.removeEventListener("visibilitychange", sync);
        window.removeEventListener("blur", sync);
        window.removeEventListener("focus", sync);
      };
    }, []);

    return (
      <div ref={root} className="aurora" aria-hidden="true">
        <span className="aurora-blob aurora-b1" />
        <span className="aurora-blob aurora-b2" />
        <span className="aurora-blob aurora-b3" />
        <span className="aurora-blob aurora-b4" />
        {/* overlay gelap tipis supaya panel lirik tetap terbaca */}
        <span className="aurora-overlay" />
      </div>
    );
  },
);
