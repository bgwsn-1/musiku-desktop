// Floating 2-Row Player Bar di bagian bawah kanvas tengah shell desktop.
// Baris 1: waktu berjalan + scrub bar penuh + sisa waktu (-mm:ss)
// Baris 2: kontrol kiri, kotak trek inset tengah, volume & mode layar penuh di kanan.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { LiquidGlass } from "@/components/ui/apple-tahoe-liquid-glass-button";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconDisc,
  IconEllipsis,
  IconExpand,
  IconHeart,
  IconMusic,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconVolume,
  IconVolumeMute,
} from "@/components/Icons";

const fmt = (s) => {
  const n = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

export const DesktopPlayerBar = memo(function DesktopPlayerBar({
  rightOpen,
  onToggleRight,
  onOpenImmersive,
  onOpenCoverFlow,
  overlaysOpen,
}) {
  const p = usePlayer();
  const {
    current,
    playing,
    duration,
    shuffle,
    repeat,
    autoplay,
    volume,
    muted,
    toggle,
    next,
    prev,
    seek,
    toggleShuffle,
    cycleRepeat,
    toggleAutoplay,
    toggleMute,
    setVolume,
    isLiked,
    toggleLike,
  } = p;

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const scrubRef = useRef(null);
  const fillRef = useRef(null);
  const curRef = useRef(null);
  const remRef = useRef(null);
  const anchor = useRef({ pos: p.position, ts: performance.now(), playing });
  const drag = useRef({ on: false, ratio: 0 });
  const raf = useRef(0);
  const lastSec = useRef(-1);
  const hiddenRef = useRef(
    typeof document !== "undefined" && document.visibilityState === "hidden",
  );

  const refs = useRef({
    seek,
    toggle,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    toggleMute,
    toggleLike,
    current,
    duration,
    position: p.position,
    overlaysOpen,
    onToggleRight,
    onOpenImmersive,
  });
  refs.current = {
    seek,
    toggle,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    toggleMute,
    toggleLike,
    current,
    duration,
    position: p.position,
    overlaysOpen,
    onToggleRight,
    onOpenImmersive,
  };

  const shouldAnimate = useCallback(
    () => !hiddenRef.current && (anchor.current.playing || drag.current.on),
    [],
  );

  const paint = useCallback(
    (now) => {
      raf.current = 0;
      const d = duration > 0 ? duration : 0;
      const a = anchor.current;
      let pos = a.playing ? a.pos + (now - a.ts) / 1000 : a.pos;
      if (d) pos = Math.min(d, Math.max(0, pos));
      if (drag.current.on) pos = drag.current.ratio * d;
      const ratio = d ? pos / d : 0;

      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${ratio})`;
      }
      const sec = Math.floor(pos);
      if (sec !== lastSec.current) {
        lastSec.current = sec;
        if (curRef.current) curRef.current.textContent = fmt(sec);
        if (remRef.current) {
          remRef.current.textContent = d ? `-${fmt(Math.max(0, Math.ceil(d - pos)))}` : "-0:00";
        }
      }
      if (shouldAnimate()) {
        raf.current = requestAnimationFrame(paint);
      }
    },
    [duration, shouldAnimate],
  );

  const kick = useCallback(() => {
    if (!raf.current) {
      raf.current = requestAnimationFrame(paint);
    }
  }, [paint]);

  useEffect(() => {
    anchor.current = { pos: p.position, ts: performance.now(), playing };
    kick();
  }, [p.position, playing, duration, kick]);

  useEffect(() => {
    const onVis = () => {
      hiddenRef.current = document.visibilityState === "hidden";
      if (hiddenRef.current && raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      } else if (!hiddenRef.current) {
        kick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      }
    };
  }, [kick]);

  // Pintasan keyboard global (ketika tidak sedang mengetik di input dan tidak ada overlay aktif).
  useEffect(() => {
    const isEditable = (el) =>
      !!el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']") ||
      !!el?.isContentEditable;

    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target) || isEditable(document.activeElement)) return;
      if (e.key === "/") {
        const searchEl = document.getElementById("ds-search-input");
        if (searchEl) {
          e.preventDefault();
          searchEl.focus();
        }
        return;
      }
      const r = refs.current;
      if (r.overlaysOpen || !r.current) return;
      if (e.key === " " && !document.activeElement?.closest?.("button, a, [role=slider]")) {
        e.preventDefault();
        r.toggle();
      } else if (e.key === "q" || e.key === "Q") {
        r.onToggleRight?.("queue");
      } else if (e.key === "y" || e.key === "Y") {
        r.onToggleRight?.("lyrics");
      } else if (e.key === "s" || e.key === "S") {
        r.toggleShuffle();
      } else if (e.key === "r" || e.key === "R") {
        r.cycleRepeat();
      } else if (e.key === "m" || e.key === "M") {
        r.toggleMute();
      } else if (e.key === "l" || e.key === "L") {
        r.toggleLike(r.current);
      } else if (e.key === "f" || e.key === "F") {
        r.onOpenImmersive?.();
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !document.activeElement?.closest?.("[role=slider]")) {
        const nextPos = Math.min(
          r.duration || Infinity,
          Math.max(0, r.position + (e.key === "ArrowRight" ? 5 : -5)),
        );
        r.seek(nextPos);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!current) return null;

  const ratioAt = (clientX) => {
    const r = scrubRef.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onScrubDown = (e) => {
    if (!duration) return;
    drag.current.on = true;
    drag.current.ratio = ratioAt(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (scrubRef.current) scrubRef.current.dataset.dragging = "1";
    kick();
  };

  const onScrubMove = (e) => {
    if (!drag.current.on) return;
    drag.current.ratio = ratioAt(e.clientX);
    kick();
  };

  const onScrubUp = () => {
    if (!drag.current.on) return;
    const nextPos = drag.current.ratio * duration;
    drag.current.on = false;
    if (scrubRef.current) delete scrubRef.current.dataset.dragging;
    seek(nextPos);
    anchor.current = { pos: nextPos, ts: performance.now(), playing };
    kick();
  };

  const onScrubKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const nextPos = Math.min(
      duration || Infinity,
      Math.max(0, p.position + (e.key === "ArrowRight" ? 5 : -5)),
    );
    seek(nextPos);
    anchor.current = { pos: nextPos, ts: performance.now(), playing };
    kick();
  };

  const artistText = current.artist || current.artists?.[0] || "";
  const sub = [current.album, artistText].filter(Boolean).join(" · ");
  const liked = isLiked?.(current.videoId) ?? false;
  const volVal = muted ? 0 : volume ?? 1;

  return (
    <>
      <div className="ds-player-wrap">
        <LiquidGlass
          material="regular"
          appearance="dark"
          refraction={18}
          bezel={20}
          blur={1.5}
          fallbackBlur={22}
          saturation={1.35}
          brightness={1.02}
          interactive={false}
          role="region"
          aria-label="Kontrol pemutar musik"
          className="ds-player"
        >
          <div className="ds-player-timeline">
            <span ref={curRef} className="ds-time" aria-hidden="true">
              0:00
            </span>
            <div
              ref={scrubRef}
              className="ds-scrub"
              role="slider"
              tabIndex={0}
              aria-label="Posisi lagu"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration || 0)}
              aria-valuenow={Math.round(p.position || 0)}
              aria-valuetext={`${fmt(p.position)} dari ${fmt(duration)}`}
              onPointerDown={onScrubDown}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubUp}
              onPointerCancel={onScrubUp}
              onKeyDown={onScrubKey}
            >
              <div className="ds-scrub-rail">
                <div ref={fillRef} className="ds-scrub-fill" />
              </div>
            </div>
            <span ref={remRef} className="ds-time ds-time-rem" aria-hidden="true">
              -0:00
            </span>
          </div>

          <div className="ds-player-row">
            <div className="ds-player-left">
              <button
                type="button"
                className="ds-pbtn"
                onClick={toggleShuffle}
                data-active={shuffle ? "1" : undefined}
                aria-pressed={!!shuffle}
                aria-label={shuffle ? "Matikan acak" : "Aktifkan acak"}
                title="Acak (S)"
              >
                <IconShuffle className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="ds-pbtn"
                onClick={prev}
                aria-label="Lagu sebelumnya"
                title="Sebelumnya"
              >
                <IconPrev className="h-[17px] w-[17px]" />
              </button>

              <button
                type="button"
                className="ds-pbtn ds-pbtn-play"
                onClick={toggle}
                aria-label={playing ? "Jeda" : "Putar"}
                title={playing ? "Jeda (Space)" : "Putar (Space)"}
              >
                {playing ? (
                  <IconPause className="h-[19px] w-[19px]" />
                ) : (
                  <IconPlay className="h-[19px] w-[19px]" />
                )}
              </button>

              <button
                type="button"
                className="ds-pbtn"
                onClick={next}
                aria-label="Lagu berikutnya"
                title="Berikutnya"
              >
                <IconNext className="h-[17px] w-[17px]" />
              </button>

              <button
                type="button"
                className="ds-pbtn"
                onClick={cycleRepeat}
                data-active={repeat && repeat !== "off" ? "1" : undefined}
                aria-pressed={!!(repeat && repeat !== "off")}
                aria-label="Ubah mode ulangi"
                title="Ulangi (R)"
              >
                {repeat === "one" ? (
                  <IconRepeatOne className="h-4 w-4" />
                ) : (
                  <IconRepeat className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                className="ds-pbtn"
                onClick={() => toggleLike?.(current)}
                data-active={liked ? "1" : undefined}
                aria-pressed={liked}
                aria-label={liked ? "Hapus dari disukai" : "Sukai lagu"}
                title="Sukai (L)"
              >
                <IconHeart filled={liked} className="h-4 w-4" />
              </button>
            </div>

            <div className="ds-player-track">
              <button
                type="button"
                className="ds-player-art-btn"
                onClick={onOpenImmersive}
                aria-label="Buka mode lirik imersif"
                title="Mode imersif (F)"
              >
                {current.thumbs ? (
                  <img
                    src={current.thumbs}
                    alt=""
                    width="36"
                    height="36"
                    className="ds-player-art"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <IconMusic className="h-4 w-4 text-white/50" />
                  </span>
                )}
              </button>

              <div className="ds-player-meta">
                <p className="ds-player-title">{current.title || "Lagu tanpa judul"}</p>
                {sub && <p className="ds-player-sub">{sub}</p>}
              </div>

              <button
                type="button"
                className="ds-pbtn"
                onClick={onOpenImmersive}
                aria-label="Perluas ke mode imersif"
                title="Mode imersif (F)"
              >
                <IconExpand className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="ds-pbtn"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenuAnchor({ x: r.right, y: r.top - 8, end: true });
                }}
                aria-haspopup="menu"
                aria-label="Opsi lagu lainnya"
                title="Opsi lainnya"
              >
                <IconEllipsis className="h-4 w-4" />
              </button>
            </div>

            <div className="ds-player-right">
              <div className="ds-player-vol">
                <button
                  type="button"
                  className="ds-pbtn"
                  onClick={toggleMute}
                  aria-label={muted || volVal === 0 ? "Bunyikan suara" : "Bisukan suara"}
                  title="Bisukan (M)"
                >
                  {muted || volVal === 0 ? (
                    <IconVolumeMute className="h-4 w-4" />
                  ) : (
                    <IconVolume className="h-4 w-4" />
                  )}
                </button>
                <label htmlFor="ds-player-vol-range" className="sr-only">
                  Volume
                </label>
                <input
                  id="ds-player-vol-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volVal}
                  onChange={(e) => setVolume?.(Number(e.target.value))}
                  className="ds-vol-slider"
                />
              </div>

              <button
                type="button"
                className="ds-pbtn hidden lg:inline-flex"
                onClick={onOpenCoverFlow}
                aria-label="Buka Cover Flow"
                title="Cover Flow"
              >
                <IconDisc className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="ds-pbtn lg:hidden"
                onClick={() => onToggleRight?.("queue")}
                data-active={rightOpen ? "1" : undefined}
                aria-label="Tampilkan antrean"
              >
                <IconQueue className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="ds-pbtn"
                onClick={toggleAutoplay}
                data-active={autoplay ? "1" : undefined}
                aria-pressed={!!autoplay}
                aria-label={autoplay ? "Matikan AutoPlay" : "Aktifkan AutoPlay"}
                title="AutoPlay"
              >
                <span className="text-[11px] font-bold tracking-tight">∞</span>
              </button>
            </div>
          </div>
        </LiquidGlass>
      </div>

      {menuAnchor && (
        <TrackMenu
          track={current}
          anchor={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          onAddToPlaylist={() => setAddOpen(true)}
        />
      )}
      {addOpen && <AddToPlaylistMenu track={current} onClose={() => setAddOpen(false)} />}
    </>
  );
});
