// Playing Screen desktop 100% mengikuti YesPlayMusic (lib/pages/now_playing.dart):
// - Topbar tab terpusat di atas: [Sedang Diputar] [Antrean] (tanpa tombol X di pojok kanan).
// - Kiri atas: _TrackInfo (judul 22px ArchivoWide, artis 13px, garis aksen 48x3px) di atas Lirik / Antrean.
// - Jika lagu tidak punya lirik pada tab Sedang Diputar: tampilkan _BigInfo (judul raksasa 80px ArchivoWide).
// - Kanan: _Art miring 6 derajat meluber sedikit ke tepi kanan, mengecil 0.94 saat pause, mendukung Apple Motion Art.
// - Bawah: _BottomBar tersegmentasi 72px (Collapse | Scrubber Putih Penuh | Shuffle | Kontrol Putih | Repeat | Heart | Volume | More).
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Hls from "hls.js";
import { usePlayer } from "@/lib/player";
import { IconMusic, IconPause, IconPlay } from "@/components/Icons";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ImmersiveDock } from "./ImmersiveDock";
import { ImmersiveQueue } from "./ImmersiveQueue";
import { DesktopNowPlayingLyrics } from "./DesktopNowPlayingLyrics";
import { trackKeyOf, useAppleArtwork } from "./useAppleArtwork";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ImmersiveStage = memo(function ImmersiveStage({ track, onExit }) {
  const t = track;
  const { playing, toggle } = usePlayer();
  const videoRef = useRef(null);
  const auroraRef = useRef(null);
  const [motionOk, setMotionOk] = useState(true);
  const [motionPaused, setMotionPaused] = useState(() => reduced());
  const [failedSrc, setFailedSrc] = useState(null);
  const [tab, setTab] = useState("lyrics"); // "lyrics" | "queue"
  const [lyricsStatus, setLyricsStatus] = useState({
    loading: true,
    hasLyrics: false,
  });
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible"
  );
  const [ctx, setCtx] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef(null);

  const requestExit = useCallback(() => {
    if (closeTimerRef.current) return;
    if (reduced()) {
      onExit?.();
      return;
    }
    setCtx(null);
    setAddOpen(false);
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onExit?.();
    }, 340);
  }, [onExit]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  const trackKey = trackKeyOf(t);
  const art = useAppleArtwork(t);

  useEffect(() => {
    const sync = () =>
      setVisible(
        typeof document === "undefined" || document.visibilityState === "visible"
      );
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (!t || !art.ready) return;
    auroraRef.current?.setCover(art.still || t.thumbs || null);
  }, [trackKey, art.ready, art.still, t?.thumbs]);

  useEffect(() => {
    setMotionOk(true);
    setFailedSrc(null);
    setLyricsStatus({ loading: true, hasLyrics: false });
  }, [trackKey]);

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
      hls = new Hls({
        enableWorker: true,
        maxBufferLength: 12,
        backBufferLength: 12,
      });
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
      requestExit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestExit, addOpen]);

  const handleLyricsStatus = useCallback((st) => {
    setLyricsStatus(st);
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
  const artistLabel = Array.isArray(t.artists)
    ? t.artists.filter(Boolean).join(", ")
    : t.artists || t.artist || "Artis tidak diketahui";
  const albumLabel =
    typeof t.album === "string" ? t.album : t.album?.name || "";
  const albumHref = t.albumId ? `/album/${encodeURIComponent(t.albumId)}` : null;
  const artistHref = t.artistId
    ? `/artist/${encodeURIComponent(t.artistId)}`
    : null;

  const showBigInfo =
    tab === "lyrics" && !lyricsStatus.loading && !lyricsStatus.hasLyrics;

  return (
    <div
      role="region"
      aria-label="Layar pemutar"
      className={`ypm-np force-dark ${closing ? "is-closing" : "is-opening"}`}
    >
      <AuroraBackground ref={auroraRef} />

      {stillSrc && (
        <img
          src={stillSrc}
          alt=""
          aria-hidden="true"
          className="ypm-np-bg"
        />
      )}
      <div className="ypm-np-scrim" aria-hidden="true" />

      {/* Artwork Miring 6 Derajat di Kanan (meluber sedikit ke tepi kanan seperti YesPlayMusic _Art) */}
      <div className="ypm-np-art-layer">
        <div
          className={`ypm-np-art-scale ${playing ? "is-playing" : "is-paused"}`}
        >
          <div
            className="ypm-np-art-card"
            onDoubleClick={toggle}
            title="Klik dua kali untuk putar/jeda"
          >
            {useMotion ? (
              <video
                ref={videoRef}
                className="ypm-np-art-media"
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
                className="ypm-np-art-media"
                fetchPriority="high"
                onError={() => setFailedSrc(stillSrc)}
              />
            ) : (
              <div className="ypm-np-art-media ypm-np-art-fb">
                <IconMusic className="h-24 w-24" />
              </div>
            )}

            {useMotion && (
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Jeda" : "Putar"}
                className={`ypm-np-art-play ${!playing ? "is-paused" : ""}`}
              >
                {playing ? (
                  <IconPause className="h-7 w-7" />
                ) : (
                  <IconPlay className="h-7 w-7" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Topbar Terpusat (YesPlayMusic _TopBar: [Sedang Diputar] [Antrean]) */}
      <header className="ypm-np-topbar">
        <div className="ypm-np-pills" role="tablist" aria-label="Tampilan pemutar">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lyrics"}
            onClick={() => setTab("lyrics")}
            className={`ypm-np-pill ${tab === "lyrics" ? "is-active" : ""}`}
          >
            Sedang Diputar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "queue"}
            onClick={() => setTab("queue")}
            className={`ypm-np-pill ${tab === "queue" ? "is-active" : ""}`}
          >
            Antrean
          </button>
          {useMotion && (
            <button
              type="button"
              onClick={handleToggleMotion}
              aria-pressed={!motionPaused}
              className={`ypm-np-pill ${!motionPaused ? "is-active" : ""}`}
            >
              {motionPaused ? "Motion: Jeda" : "Motion Art"}
            </button>
          )}
        </div>
      </header>

      {/* Kolom Konten Kiri (left: 40px, width: min(760px, 56vw), bottom: 118px) */}
      <div className="ypm-np-left-col">
        {/* _TrackInfo kompak (tersembunyi saat mode _BigInfo tanpa lirik) */}
        <div
          className={`ypm-np-trackinfo ${showBigInfo ? "is-hidden" : ""}`}
          aria-hidden={showBigInfo}
        >
          {albumLabel &&
            (albumHref ? (
              <Link
                href={albumHref}
                onClick={requestExit}
                className="ypm-np-from"
              >
                Dari {albumLabel}
              </Link>
            ) : (
              <span className="ypm-np-from">Dari {albumLabel}</span>
            ))}

          {albumHref ? (
            <Link
              href={albumHref}
              onClick={requestExit}
              className="ypm-np-ti-title"
            >
              {t.title}
            </Link>
          ) : (
            <h1 className="ypm-np-ti-title">{t.title}</h1>
          )}

          {artistHref ? (
            <Link
              href={artistHref}
              onClick={requestExit}
              className="ypm-np-ti-artist"
            >
              {artistLabel}
            </Link>
          ) : (
            <p className="ypm-np-ti-artist">{artistLabel}</p>
          )}

          <div className="ypm-np-ti-bar" aria-hidden="true" />
        </div>

        {/* _BigInfo saat tidak ada lirik (80px ArchivoWide) */}
        {showBigInfo && (
          <div className="ypm-np-biginfo">
            {albumLabel && (
              <span className="ypm-np-big-from">Dari {albumLabel}</span>
            )}
            <h1 className="ypm-np-big-title">{t.title}</h1>
            <p className="ypm-np-big-artist">{artistLabel}</p>
          </div>
        )}

        {/* Area Lirik atau Antrean (dimulai di bawah _TrackInfo) */}
        <div
          className={`ypm-np-body ${showBigInfo ? "is-hidden" : ""}`}
        >
          {tab === "lyrics" ? (
            <DesktopNowPlayingLyrics
              trackId={t.videoId}
              onStatus={handleLyricsStatus}
            />
          ) : (
            <ImmersiveQueue />
          )}
        </div>
      </div>

      {/* Bottom Segmented Bar (72px tinggi, radius 24px, persis YesPlayMusic _BottomBar) */}
      <ImmersiveDock onExit={requestExit} onOpenMenu={handleOpenMenu} />

      {ctx && (
        <TrackMenu
          track={t}
          anchor={ctx}
          onClose={() => setCtx(null)}
          onAddToPlaylist={() => setAddOpen(true)}
        />
      )}
      {addOpen && (
        <AddToPlaylistMenu track={t} onClose={() => setAddOpen(false)} />
      )}
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
