// Mode lirik imersif — HANYA untuk bundle desktop (Windows/Linux).
// Web/Android memakai stub di src/components/ImmersiveLyrics.tsx.
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { usePlayer } from "@/lib/player";
import { LyricsPanel } from "@/components/LyricsPanel";
import { IconClose, IconEllipsis, IconMusic } from "@/components/Icons";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import { AuroraBackground } from "@/components/AuroraBackground";

const EMPTY = { motion: null, still: null };
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ImmersiveLyrics({ onExit }) {
  const p = usePlayer();
  const t = p.current;
  const videoRef = useRef(null);
  const auroraRef = useRef(null);
  const [artState, setArtState] = useState({ trackKey: "", ...EMPTY });
  const [motionOk, setMotionOk] = useState(true);
  const [stillFailed, setStillFailed] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const trackKey = t ? `${t.videoId}|${t.title || ""}|${t.artist || ""}` : "";
  const activeTrackKey = useRef(trackKey);
  activeTrackKey.current = trackKey;
  const art = artState.trackKey === trackKey ? artState : EMPTY;

  // Palet aurora dari cover yang lagi diputar.
  useEffect(() => {
    if (!t) return;
    auroraRef.current?.setCover(t.thumbs || null);
  }, []);
  useEffect(() => {
    if (!t) return;
    auroraRef.current?.setCover(art.still || t.thumbs || null);
  }, [trackKey, art.still]);

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

  // Motion Art = HLS. hls.js membersihkan InstancedHttpStream-nya saat unmount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !art.motion || !motionOk) return;
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
  }, [art.motion, motionOk, trackKey]);

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

  return (
    <div
      role="region"
      aria-label="Lirik imersif"
      className="im-root force-dark dialog-in fixed inset-0 z-[70] hidden overflow-hidden bg-window lg:flex"
    >
      <AuroraBackground ref={auroraRef} />
      <div className="im-scrim" aria-hidden="true" />

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
          <div className="im-lyrics min-h-0 flex-1">
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
