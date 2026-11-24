"use client";

import { useEffect, useRef, useState } from "react";

/** Panjang potongan yang diulang (detik). */
const SEGMENT = 12;

/**
 * Header bergerak: klip senyap dari video resmi artis, diulang 12 detik.
 * Hanya stream video (tanpa audio) yang diunduh, dan hanya kalau pengguna
 * tidak meminta reduced motion / hemat data. Gambar HD tetap jadi poster
 * sampai frame pertama siap, jadi header tidak pernah kosong.
 */
export function ArtistVideo({ videoId }: { videoId?: string | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Jangan unduh video kalau tidak perlu, dan jangan rebut bandwidth saat
  // beranda masih memuat cover. Poster tetap tampil sampai video siap.
  useEffect(() => {
    if (!videoId) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const save = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (mq.matches || save?.saveData) return;
    if (save?.effectiveType === "slow-2g" || save?.effectiveType === "2g")
      return;

    let live = true;
    let idle: number | undefined;
    let timer: number | undefined;
    const kick = () => {
      if (live) setSrc(`/api/stream/${videoId}?video=1`);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      idle = w.requestIdleCallback(kick, { timeout: 1500 });
    } else {
      timer = window.setTimeout(kick, 500);
    }
    return () => {
      live = false;
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [videoId]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;

    let start = 20;
    let resetting = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    const seek = (t: number) => {
      resetting = true;
      if (resetTimer) clearTimeout(resetTimer);
      // kalau `seeked` tak pernah datang (belum ter-buffer), jangan terkunci
      resetTimer = setTimeout(() => {
        resetting = false;
      }, 1800);
      try {
        v.currentTime = t;
      } catch {
        /* metadata belum siap */
      }
    };

    const onMeta = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      // lewati intro; ambil bagian tengah lagu
      start = d > 40 ? Math.min(75, Math.max(15, d * 0.18)) : d * 0.3;
      seek(start);
    };
    const onTime = () => {
      if (resetting) return;
      if (v.currentTime < start - 1 || v.currentTime > start + SEGMENT) {
        seek(start);
      }
    };
    const onSeeked = () => {
      resetting = false;
      if (resetTimer) clearTimeout(resetTimer);
      // browser menolak seek (mis. belum bisa range) → main dari awal
      if (start > 1 && v.currentTime < 1) start = 0;
    };
    const onPlaying = () => setPlaying(true);
    const onError = () => setPlaying(false);
    const kick = () => {
      v.play().catch(() => {
        /* autoplay bisa ditolak; poster tetap tampil */
      });
    };

    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("canplay", kick);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onError);
    kick();

    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("canplay", kick);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onError);
      if (resetTimer) clearTimeout(resetTimer);
      v.pause();
    };
  }, [src]);

  if (!videoId) return null;

  return (
    <video
      ref={ref}
      src={src ?? undefined}
      className={`artist-hero-video${playing ? " is-playing" : ""}`}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
      aria-hidden="true"
      disablePictureInPicture
    />
  );
}
