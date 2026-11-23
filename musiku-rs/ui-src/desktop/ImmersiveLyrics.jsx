// Mode lirik imersif — HANYA untuk bundle desktop (Windows/Linux).
// Web/Android memakai stub di src/components/ImmersiveLyrics.tsx.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { usePlayer } from "@/lib/player";
import { LyricsPanel } from "@/components/LyricsPanel";
import { IconClose, IconEllipsis, IconMusic } from "@/components/Icons";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import { AuroraBackground } from "@/components/AuroraBackground";
import { AURORA_FALLBACK } from "@/lib/aurora-palette";
import { ImmersiveProgressBar } from "./ImmersiveProgressBar";
import { ImmersiveControls } from "./ImmersiveControls";
import { trackKeyOf, useAppleArtwork } from "./useAppleArtwork";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Shadow cover memakai warna dominan palet aurora (alpha ~0.35), bukan hitam.
const GLOW_ALPHA = 0.35;
const hexToRgba = (hex, alpha) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return `rgba(43, 47, 74, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// Stage di-memo: tick posisi player tidak me-render ulang artwork / HLS / aurora.
const ImmersiveStage = memo(function ImmersiveStage({ track, onExit }) {
  const t = track;
  const videoRef = useRef(null);
  const auroraRef = useRef(null);
  const [motionOk, setMotionOk] = useState(true);
  const [failedSrc, setFailedSrc] = useState(null);
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [ctx, setCtx] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [palette, setPalette] = useState(AURORA_FALLBACK);

  const trackKey = trackKeyOf(t);
  const art = useAppleArtwork(t);

  // Hentikan motion art saat window tak terlihat (minimize / tab lain).
  useEffect(() => {
    const sync = () =>
      setVisible(typeof document === "undefined" || document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Palet aurora: tunggu resolver artwork selesai supaya hanya crossfade sekali.
  useEffect(() => {
    if (!t || !art.ready) return;
    auroraRef.current?.setCover(art.still || t.thumbs || null);
  }, [trackKey, art.ready, art.still, t?.thumbs]);

  // Artwork di-resolve hook bersama (cache + abort). Reset state lokal per lagu.
  useEffect(() => {
    setMotionOk(true);
    setFailedSrc(null);
  }, [trackKey]);

  // Motion Art = HLS. hls.js membersihkan InstancedHttpStream-nya saat unmount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !art.motion || !motionOk || !visible) return;
    let hls = null;
    const isReduced = reduced();
    const play = () => {
      if (isReduced) {
        video.pause();
        return;
      }
      video.play().catch(() => {});
    };

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
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [art.motion, motionOk, trackKey, visible]);

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
  const stillSrc =
    art.still && failedSrc !== art.still
      ? art.still
      : t.thumbs && failedSrc !== t.thumbs
        ? t.thumbs
        : null;

  return (
    <div
      role="region"
      aria-label="Lirik imersif"
      className="im-root force-dark dialog-in fixed inset-0 z-[70] hidden overflow-hidden bg-window lg:flex"
    >
      <AuroraBackground ref={auroraRef} onColors={setPalette} />
      <div className="im-scrim" aria-hidden="true" />

      <div className="im-body relative flex min-h-0 flex-1">
        <div className="im-left relative flex min-w-0 basis-[44%] flex-col items-center justify-center px-10 py-10">
          <div
            className="im-art-wrap w-full max-w-[min(50dvh,440px)]"
            style={{ "--im-glow": hexToRgba(palette[0], GLOW_ALPHA) }}
          >
            <div className="im-art aspect-square w-full">
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
                  fetchPriority="high"
                  onError={() => setFailedSrc(stillSrc)}
                />
              ) : (
                <div className="im-art-fallback">
                  <IconMusic className="h-1/3 w-1/3 text-label3" />
                </div>
              )}
            </div>

            <ImmersiveProgressBar />

            <div className="im-meta">
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

            <ImmersiveControls />
          </div>
        </div>

        <div className="im-right relative flex min-w-0 flex-1 flex-col pb-10 pr-10 pt-20">
          <div className="im-lyrics min-h-0 flex-1">
            <LyricsPanel immersive />
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

      {ctx && (
        <TrackMenu track={t} anchor={ctx} onClose={() => setCtx(null)} onAddToPlaylist={() => setAddOpen(true)} />
      )}
      {addOpen && <AddToPlaylistMenu track={t} onClose={() => setAddOpen(false)} />}
    </div>
  );
});

export function ImmersiveLyrics({ onExit }) {
  const p = usePlayer();
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const stableExit = useCallback(() => onExitRef.current?.(), []);
  return <ImmersiveStage track={p.current} onExit={stableExit} />;
}
