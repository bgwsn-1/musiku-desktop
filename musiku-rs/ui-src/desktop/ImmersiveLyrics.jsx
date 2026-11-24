// Mode lirik imersif — HANYA untuk bundle desktop (Windows/Linux/macOS).
// Web/Android memakai stub di src/components/ImmersiveLyrics.tsx.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { usePlayer } from "@/lib/player";
import { LyricsPanel } from "@/components/LyricsPanel";
import { IconMusic } from "@/components/Icons";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ImmersiveDock } from "./ImmersiveDock";
import { ImmersiveQueue } from "./ImmersiveQueue";
import { trackKeyOf, useAppleArtwork } from "./useAppleArtwork";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Stage di-memo: tick posisi player tidak me-render ulang artwork / HLS / aurora.
const ImmersiveStage = memo(function ImmersiveStage({ track, onExit }) {
  const t = track;
  const videoRef = useRef(null);
  const auroraRef = useRef(null);
  const [motionOk, setMotionOk] = useState(true);
  const [motionPaused, setMotionPaused] = useState(() => reduced());
  const [failedSrc, setFailedSrc] = useState(null);
  const [rightView, setRightView] = useState("lyrics"); // "lyrics" | "queue" | null
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [ctx, setCtx] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

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

  // Reset state lokal per lagu.
  useEffect(() => {
    setMotionOk(true);
    setFailedSrc(null);
  }, [trackKey]);

  // Motion Art = HLS. hls.js membersihkan InstancedHttpStream-nya saat unmount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !art.motion || !motionOk || !visible) return;
    let hls = null;
    const syncPlay = () => {
      if (reduced() || motionPaused) {
        video.pause();
        return;
      }
      video.play().catch(() => {});
    };

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, maxBufferLength: 12, backBufferLength: 12 });
      hls.loadSource(art.motion);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, syncPlay);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setMotionOk(false);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = art.motion;
      video.addEventListener("loadedmetadata", syncPlay, { once: true });
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

  // Sinkronkan jeda/putar Motion Art saat user menekan tombol kontrol motion.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !art.motion || !motionOk) return;
    if (motionPaused || reduced()) {
      video.pause();
    } else if (visible) {
      video.play().catch(() => {});
    }
  }, [motionPaused, art.motion, motionOk, visible]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[role=menu]")) return;
      if (addOpen) {
        setAddOpen(false);
        return;
      }
      onExit?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onExit, addOpen]);

  const handleToggleLyrics = useCallback(() => {
    setRightView((v) => (v === "lyrics" ? null : "lyrics"));
  }, []);

  const handleToggleQueue = useCallback(() => {
    setRightView((v) => (v === "queue" ? null : "queue"));
  }, []);

  const handleToggleMotion = useCallback(() => {
    setMotionPaused((v) => !v);
  }, []);

  const handleOpenMenu = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setCtx({ x: r.right, y: r.top - 8, end: true });
  }, []);

  if (!t) return null;

  const useMotion = !!art.motion && motionOk;
  const stillSrc =
    art.still && failedSrc !== art.still
      ? art.still
      : t.thumbs && failedSrc !== t.thumbs
        ? t.thumbs
        : null;
  const panelOpen = rightView !== null;

  return (
    <div
      role="region"
      aria-label="Lirik imersif"
      data-panel={panelOpen ? "open" : "closed"}
      className="im-root im-stage force-dark dialog-in"
    >
      <AuroraBackground ref={auroraRef} />

      <div className="im-hero-layer" aria-hidden="true">
        {stillSrc && (
          <img
            src={stillSrc}
            alt=""
            width="1200"
            height="1200"
            className="im-hero-ambient"
          />
        )}
        {useMotion ? (
          <video
            ref={videoRef}
            className="im-hero-art"
            width="1200"
            height="1200"
            poster={stillSrc || undefined}
            muted
            loop
            playsInline
            aria-label={`Motion Art ${t.title}`}
          />
        ) : stillSrc ? (
          <img
            src={stillSrc}
            alt={`Sampul ${t.title}`}
            className="im-hero-art"
            width="1200"
            height="1200"
            fetchPriority="high"
            onError={() => setFailedSrc(stillSrc)}
          />
        ) : (
          <div className="im-hero-fallback">
            <IconMusic className="h-32 w-32 text-white/40" />
          </div>
        )}
      </div>

      <div className="im-hero-scrim" aria-hidden="true" />

      <div className="im-workspace">
        {panelOpen && (
          <div className="im-panel-card">
            {rightView === "lyrics" ? (
              <div className="im-lyrics">
                <LyricsPanel immersive />
              </div>
            ) : (
              <ImmersiveQueue />
            )}
          </div>
        )}
      </div>

      <ImmersiveDock
        rightView={rightView}
        onToggleLyrics={handleToggleLyrics}
        onToggleQueue={handleToggleQueue}
        hasMotion={useMotion}
        motionPaused={motionPaused}
        onToggleMotion={handleToggleMotion}
        onOpenMenu={handleOpenMenu}
        onExit={onExit}
      />

      {ctx && (
        <TrackMenu
          track={t}
          anchor={ctx}
          onClose={() => setCtx(null)}
          onAddToPlaylist={() => setAddOpen(true)}
        />
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
