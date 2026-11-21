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
  if (!d) return `hsl(0 0% ${(l * 100).toFixed(1)}%)`;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return `hsl(${Math.round(h)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
};

/** Warna dominan cover → tone gradient, plus raster kecil yang sudah di-blur. */
function extract(source) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2D tidak tersedia");
  ctx.drawImage(source, 0, 0, 64, 64);
  const px = ctx.getImageData(0, 0, 64, 64).data;

  const buckets = new Map();
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const alpha = px[i + 3] / 255;
    if (alpha < 0.1) continue;
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    e.r += r * alpha;
    e.g += g * alpha;
    e.b += b * alpha;
    e.n += alpha;
    buckets.set(key, e);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  if (!sorted.length) throw new Error("tidak ada warna dominan");
  const avg = (e) => [e.r / e.n, e.g / e.n, e.b / e.n];
  const first = avg(sorted[0]);
  const far =
    sorted.slice(1).find((e) => {
      const c2 = avg(e);
      return Math.hypot(c2[0] - first[0], c2[1] - first[1], c2[2] - first[2]) > 28;
    }) || sorted[0];

  const blur = document.createElement("canvas");
  blur.width = 72;
  blur.height = 72;
  const bctx = blur.getContext("2d");
  if (!bctx) throw new Error("canvas 2D tidak tersedia");
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
  const [artState, setArtState] = useState({ trackKey: "", ...EMPTY });
  const [motionOk, setMotionOk] = useState(true);
  const [stillFailed, setStillFailed] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [ctx, setCtx] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const trackKey = t ? `${t.videoId}|${t.title || ""}|${t.artist || ""}` : "";
  const activeTrackKey = useRef(trackKey);
  activeTrackKey.current = trackKey;
  const art = artState.trackKey === trackKey ? artState : EMPTY;

  const pushScene = useCallback(
    (source, sampleKey, sourceTrackKey) => {
      if (activeTrackKey.current !== sourceTrackKey || sampled.current === sampleKey) return;
      const palette = extract(source);
      sampled.current = sampleKey;
      setScenes((prev) => {
        const next = { id: sampleKey, ...palette };
        if (prev[prev.length - 1]?.id === sampleKey) return [...prev.slice(0, -1), next];
        return [...prev.slice(-1), next];
      });
    },
    [],
  );

  const sampleUrl = useCallback(
    (url) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          pushScene(img, `${trackKey}|still|${url}`, trackKey);
        } catch {
          /* CDN tanpa CORS → warna pakai fallback */
        }
      };
      img.src = url;
    },
    [pushScene, trackKey],
  );

  // Resolver artwork Apple: Motion Art dulu, lalu cover statis Apple.
  useEffect(() => {
    if (!t) return;
    let live = true;
    const currentTrackKey = trackKey;
    const ac = new AbortController();
    const q = new URLSearchParams();
    q.set("title", t.title || "");
    if (t.artist) q.set("artist", String(t.artist));
    setMotionOk(true);
    setStillFailed(false);
    sampled.current = null;
    fetch(`/api/apple-artwork?${q.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || !j) return;
        setArtState({ trackKey: currentTrackKey, motion: j.motion || null, still: j.still || null });
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
    const id = setTimeout(() => setScenes((prev) => prev.slice(-1)), reduced() ? 0 : 900);
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
        pushScene(video, `${trackKey}|motion|${art.motion}`, trackKey);
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
            <div
              className="im-atmosphere"
              style={{
                "--tone": s.tone,
                "--tone2": s.tone2,
                backgroundImage: `radial-gradient(ellipse at 18% 16%, color-mix(in srgb, var(--tone) 68%, transparent), transparent 62%), radial-gradient(ellipse at 82% 78%, color-mix(in srgb, var(--tone2) 58%, transparent), transparent 58%), url(${s.blur})`,
              }}
            />
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
                width="460"
                height="460"
                poster={stillSrc}
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
                width="460"
                height="460"
                crossOrigin="anonymous"
                fetchPriority="high"
                onError={() => setStillFailed(true)}
              />
            ) : (
              <div className="im-art-fallback">
                <IconMusic className="h-1/3 w-1/3 text-label3" />
              </div>
            )}
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
