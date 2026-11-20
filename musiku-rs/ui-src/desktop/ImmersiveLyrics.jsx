// Mode lirik imersif — HANYA untuk bundle desktop (Windows/Linux).
// Web/Android memakai stub di src/components/ImmersiveLyrics.tsx.
import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { usePlayer } from "@/lib/player";
import { LyricsPanel } from "@/components/LyricsPanel";
import { IconClose, IconEllipsis, IconMusic } from "@/components/Icons";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";

const EMPTY = { motion: null, still: null };
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rgbToHsl = ([r, g, b]) => {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  const l = (max + min) / 2;
  if (!d) return `hsl(0 0% ${Math.round(l * 100)}%)`;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  const sat = Math.round(Math.min(0.9, Math.max(0.5, s)) * 100);
  const light = Math.round(Math.min(0.56, Math.max(0.32, l)) * 100);
  return `hsl(${Math.round(h)} ${sat}% ${light}%)`;
};

/** Warna dominan cover → tone gradient, plus raster kecil yang sudah di-blur. */
function extract(source) {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, 48, 48);
  const px = ctx.getImageData(0, 0, 48, 48).data;

  const buckets = new Map();
  for (let i = 0; i < px.length; i += 16) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (px[i + 3] < 200) continue;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    if (mx < 40 || mx - mn < 20) continue;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    const w = mx - mn;
    e.r += r * w;
    e.g += g * w;
    e.b += b * w;
    e.n += w;
    buckets.set(key, e);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  if (!sorted.length) throw new Error("tidak ada warna dominan");
  const avg = (e) => [e.r / e.n, e.g / e.n, e.b / e.n];
  const first = avg(sorted[0]);
  const far =
    sorted.find((e) => {
      const c2 = avg(e);
      return Math.abs(c2[0] - first[0]) + Math.abs(c2[1] - first[1]) + Math.abs(c2[2] - first[2]) > 90;
    }) || sorted[Math.min(1, sorted.length - 1)];

  const blur = document.createElement("canvas");
  blur.width = 72;
  blur.height = 72;
  const bctx = blur.getContext("2d");
  bctx.filter = "blur(8px)";
  bctx.drawImage(c, 0, 0, 72, 72);

  return {
    tone: rgbToHsl(first),
    tone2: rgbToHsl(avg(far)),
    blur: blur.toDataURL("image/jpeg", 0.7),
  };
}

export function ImmersiveLyrics({ onExit }) {
  const p = usePlayer();
  const t = p.current;
  const videoRef = useRef(null);
  const sampled = useRef(null);
  const [art, setArt] = useState(EMPTY);
  const [motionOk, setMotionOk] = useState(true);
  const [stillFailed, setStillFailed] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [ctx, setCtx] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const trackKey = t ? `${t.videoId}|${t.title || ""}|${t.artist || ""}` : "";

  const pushScene = useCallback(
    (source) => {
      if (sampled.current === trackKey) return;
      const palette = extract(source);
      sampled.current = trackKey;
      setScenes((prev) => {
        const next = { id: trackKey, ...palette };
        if (prev[prev.length - 1]?.id === trackKey) return [...prev.slice(0, -1), next];
        return [...prev.slice(-1), next];
      });
    },
    [trackKey],
  );

  const sampleUrl = useCallback(
    (url) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          pushScene(img);
        } catch {
          /* CDN tanpa CORS → warna pakai fallback */
        }
      };
      img.src = url;
    },
    [pushScene],
  );

  // Resolver artwork Apple: Motion Art dulu, lalu cover statis Apple.
  useEffect(() => {
    if (!t) return;
    let live = true;
    const ac = new AbortController();
    const q = new URLSearchParams();
    q.set("title", t.title || "");
    if (t.artist) q.set("artist", String(t.artist));
    setArt(EMPTY);
    setMotionOk(true);
    setStillFailed(false);
    sampled.current = null;
    fetch(`/api/apple-artwork?${q.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || !j) return;
        setArt({ motion: j.motion || null, still: j.still || null });
      })
      .catch(() => {});
    return () => {
      live = false;
      ac.abort();
    };
  }, [trackKey]);

  // Tanpa video yang bisa diambil frame-nya → ambil warna dari cover statis.
  useEffect(() => {
    if (!t || (art.motion && motionOk)) return;
    const src = art.still || t.thumbs;
    if (src) sampleUrl(src);
  }, [t?.videoId, art.still, art.motion, motionOk, sampleUrl]);

  // Hapus scene lama setelah crossfade selesai.
  useEffect(() => {
    if (scenes.length < 2) return;
    const id = setTimeout(() => setScenes((prev) => prev.slice(-1)), 900);
    return () => clearTimeout(id);
  }, [scenes]);

  // Motion Art = HLS. hls.js membersihkan InstancedHttpStream-nya saat unmount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !art.motion || !motionOk) return;
    let hls = null;
    const isReduced = reduced();
    const onFrame = () => {
      try {
        pushScene(video);
      } catch {
        /* frame HLS tanpa CORS → warna dari cover statis */
      }
      if (isReduced) video.pause();
    };
    const play = () => video.play().catch(() => {});
    video.addEventListener("loadeddata", onFrame);

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, maxBufferLength: 12, backBufferLength: 12 });
      hls.loadSource(art.motion);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setMotionOk(false);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = art.motion;
      video.addEventListener("loadedmetadata", play, { once: true });
    } else {
      setMotionOk(false);
    }

    return () => {
      video.removeEventListener("loadeddata", onFrame);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [art.motion, motionOk, trackKey, pushScene]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector("[role=menu]")) return;
      onExit?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onExit]);

  if (!t) return null;

  const useMotion = !!art.motion && motionOk;
  const stillSrc = stillFailed || !art.still ? t.thumbs : art.still;
  const last = scenes[scenes.length - 1];

  return (
    <div
      role="region"
      aria-label="Lirik imersif"
      className="im-root force-dark dialog-in fixed inset-0 z-[70] hidden overflow-hidden bg-window lg:flex"
    >
      <div className="im-ambient" aria-hidden="true">
        {scenes.map((s, i) => (
          <div
            key={s.id}
            className={`im-scene ${i < scenes.length - 1 ? "im-scene-old" : "im-scene-new"}`}
          >
            <div className="liquid-field">
              <div className="liquid-layer liquid-a" style={{ backgroundImage: `url(${s.blur})` }} />
              <div className="liquid-layer liquid-b" style={{ backgroundImage: `url(${s.blur})` }} />
              <div className="liquid-layer liquid-c" style={{ backgroundImage: `url(${s.blur})` }} />
            </div>
            {/* duplikat frame/cover yang sudah di-blur: jadi "aura" di belakang video */}
            <div className="im-video-glow" style={{ backgroundImage: `url(${s.blur})` }} />
            <div className="im-tone-wash" style={{ "--tone": s.tone, "--tone2": s.tone2 }} />
          </div>
        ))}
        <div className="im-scrim" />
      </div>

      <div className="im-body relative flex min-h-0 flex-1">
        <div className="im-left relative flex min-w-0 basis-[44%] flex-col items-center justify-center px-10 pb-28 pt-16">
          <div className="im-art aspect-square w-full max-w-[min(50dvh,460px)]">
            {useMotion ? (
              <video
                ref={videoRef}
                className="im-art-media"
                muted
                loop
                playsInline
                crossOrigin="anonymous"
                aria-label={`Motion Art ${t.title}`}
              />
            ) : stillSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stillSrc}
                alt={`Sampul ${t.title}`}
                className="im-art-media"
                crossOrigin="anonymous"
                onError={() => setStillFailed(true)}
              />
            ) : (
              <div className="im-art-fallback">
                <IconMusic className="h-1/3 w-1/3 text-label3" />
              </div>
            )}
            <div className="im-art-blend" style={{ "--tone": last?.tone || "#5b5b66" }} />
          </div>
        </div>

        <div className="im-right relative flex min-w-0 flex-1 flex-col py-10 pr-10">
          <div
            className="im-lyrics min-h-0 flex-1"
            style={{ "--tone": last?.tone || "#8e8e98" }}
          >
            <LyricsPanel />
          </div>
        </div>
      </div>

      <button
        onClick={onExit}
        className="im-exit glass-btn"
        aria-label="Keluar mode imersif"
        title="Keluar mode imersif (Esc)"
      >
        <IconClose className="h-5 w-5" />
      </button>

      <div className="im-card">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
            {t.title}
          </h2>
          {t.artist && (
            <p className="truncate text-[14px] leading-tight text-white/55">{t.artist}</p>
          )}
        </div>
        <span className="im-badge" title="Audio dari YouTube Music (AAC/Opus)">
          LOSSY
        </span>
        <button
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setCtx({ x: r.right, y: r.bottom + 4, end: true });
          }}
          className="im-more glass-btn"
          aria-haspopup="menu"
          aria-label="Opsi lainnya"
        >
          <IconEllipsis className="h-[20px] w-[20px]" />
        </button>
      </div>

      {ctx && (
        <TrackMenu track={t} anchor={ctx} onClose={() => setCtx(null)} onAddToPlaylist={() => setAddOpen(true)} />
      )}
      {addOpen && <AddToPlaylistMenu track={t} onClose={() => setAddOpen(false)} />}
    </div>
  );
}
