// Floating Segmented MiniPlayer di bagian bawah kanvas (gaya YesPlayMusic).
// Segmen terpisah: Info Lagu + Heart | Scrubber Progress | Shuffle | Prev/Play/Next | Repeat | Volume | Queue.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconDisc,
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

function IconChevronUp({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

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
    volume,
    muted,
    toggle,
    next,
    prev,
    seek,
    toggleShuffle,
    cycleRepeat,
    toggleMute,
    setVolume,
    isLiked,
    toggleLike,
  } = p;

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [volOpen, setVolOpen] = useState(false);

  const volRef = useRef(null);
  const scrubRef = useRef(null);
  const fillRef = useRef(null);
  const hoverFillRef = useRef(null);
  const hoverLineRef = useRef(null);
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
          remRef.current.textContent = d ? fmt(d) : "0:00";
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

  // Tutup popover volume saat klik di luar.
  useEffect(() => {
    if (!volOpen) return;
    const onDown = (e) => {
      if (!volRef.current?.contains(e.target)) setVolOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [volOpen]);

  // Pintasan keyboard global (ketika tidak sedang mengetik di input dan tidak ada overlay aktif).
  useEffect(() => {
    const isEditable = (el) =>
      !!el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']") ||
      !!el?.isContentEditable;

    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target) || isEditable(document.activeElement)) return;
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
      } else if (
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        !document.activeElement?.closest?.("[role=slider]")
      ) {
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

  const paintHover = (ratio) => {
    if (hoverFillRef.current) {
      hoverFillRef.current.style.transform = `scaleX(${ratio ?? 0})`;
      hoverFillRef.current.style.opacity = ratio == null ? "0" : "1";
    }
    if (hoverLineRef.current) {
      hoverLineRef.current.style.left = `${(ratio ?? 0) * 100}%`;
      hoverLineRef.current.style.opacity = ratio == null ? "0" : "1";
    }
  };

  const onScrubDown = (e) => {
    if (!duration) return;
    drag.current.on = true;
    drag.current.ratio = ratioAt(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (scrubRef.current) scrubRef.current.dataset.dragging = "1";
    paintHover(drag.current.ratio);
    kick();
  };

  const onScrubMove = (e) => {
    const r = ratioAt(e.clientX);
    paintHover(r);
    if (!drag.current.on) return;
    drag.current.ratio = r;
    kick();
  };

  const onScrubLeave = () => {
    if (!drag.current.on) paintHover(null);
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

  const artistText = current.artist || current.artists?.[0] || "Artis tidak diketahui";
  const liked = isLiked?.(current.videoId) ?? false;
  const volVal = muted ? 0 : volume ?? 1;

  return (
    <>
      <div className="ypm-player-wrap" role="region" aria-label="Kontrol pemutar musik">
        <div className="ypm-player-fade" aria-hidden="true" />

        <div className="ypm-player-row">
          {/* Segmen 1: Cover + Info Lagu + Heart */}
          <div
            className="ypm-seg ypm-seg-now"
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuAnchor({ x: e.clientX, y: e.clientY - 8, end: false });
            }}
          >
            <button
              type="button"
              className="ypm-now-open"
              onClick={onOpenImmersive}
              aria-label="Buka layar Now Playing"
              title="Buka Now Playing (F)"
            >
              <span className="ypm-now-art-wrap">
                {current.thumbs ? (
                  <img
                    src={current.thumbs}
                    alt=""
                    width="48"
                    height="48"
                    className="ypm-now-art"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#242428]">
                    <IconMusic className="h-5 w-5 text-[#85858f]" />
                  </span>
                )}
                <span className="ypm-now-art-hover" aria-hidden="true">
                  <IconChevronUp className="h-5 w-5" />
                </span>
              </span>
              <span className="ypm-now-meta">
                <span className="ypm-now-title">{current.title || "Lagu tanpa judul"}</span>
                <span className="ypm-now-sub">{artistText}</span>
              </span>
            </button>

            <button
              type="button"
              className="ypm-heart-btn"
              onClick={() => toggleLike?.(current)}
              data-liked={liked ? "1" : undefined}
              aria-pressed={liked}
              aria-label={liked ? "Hapus dari disukai" : "Sukai lagu"}
              title="Sukai (L)"
            >
              <IconHeart filled={liked} className="h-5 w-5" />
            </button>
          </div>

          {/* Segmen 2: Scrubber Progress Full-Height */}
          <div
            ref={scrubRef}
            className="ypm-seg ypm-seg-lyric"
            role="slider"
            tabIndex={0}
            aria-label="Posisi lagu"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || 0)}
            aria-valuenow={Math.round(p.position || 0)}
            aria-valuetext={`${fmt(p.position)} dari ${fmt(duration)}`}
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerLeave={onScrubLeave}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
            onKeyDown={onScrubKey}
          >
            <div ref={fillRef} className="ypm-scrub-fill" aria-hidden="true" />
            <div ref={hoverFillRef} className="ypm-scrub-hover" aria-hidden="true" />
            <div ref={hoverLineRef} className="ypm-scrub-cursor" aria-hidden="true" />
            <div className="ypm-scrub-times" aria-hidden="true">
              <span ref={curRef} className="ypm-scrub-t">
                0:00
              </span>
              <span ref={remRef} className="ypm-scrub-t ypm-scrub-t-dur">
                0:00
              </span>
            </div>
          </div>

          {/* Segmen 3: Shuffle */}
          <button
            type="button"
            className="ypm-seg ypm-seg-icon hidden md:inline-flex"
            onClick={toggleShuffle}
            data-active={shuffle ? "1" : undefined}
            aria-pressed={!!shuffle}
            aria-label={shuffle ? "Matikan acak" : "Aktifkan acak"}
            title="Acak (S)"
          >
            <IconShuffle className="h-5 w-5" />
            {shuffle && <span className="ypm-seg-dot" aria-hidden="true" />}
          </button>

          {/* Segmen 4: Prev / Play / Next */}
          <div className="ypm-seg ypm-seg-ctrl">
            <button
              type="button"
              className="ypm-ctrl-btn"
              onClick={prev}
              aria-label="Lagu sebelumnya"
              title="Sebelumnya"
            >
              <IconPrev className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="ypm-ctrl-btn"
              onClick={toggle}
              aria-label={playing ? "Jeda" : "Putar"}
              title={playing ? "Jeda (Space)" : "Putar (Space)"}
            >
              {playing ? (
                <IconPause className="h-6 w-6" />
              ) : (
                <IconPlay className="h-6 w-6" />
              )}
            </button>
            <button
              type="button"
              className="ypm-ctrl-btn"
              onClick={next}
              aria-label="Lagu berikutnya"
              title="Berikutnya"
            >
              <IconNext className="h-5 w-5" />
            </button>
          </div>

          {/* Segmen 5: Repeat */}
          <button
            type="button"
            className="ypm-seg ypm-seg-icon hidden md:inline-flex"
            onClick={cycleRepeat}
            data-active={repeat && repeat !== "off" ? "1" : undefined}
            aria-pressed={!!(repeat && repeat !== "off")}
            aria-label="Ubah mode ulangi"
            title="Ulangi (R)"
          >
            {repeat === "one" ? (
              <IconRepeatOne className="h-5 w-5" />
            ) : (
              <IconRepeat className="h-5 w-5" />
            )}
            {repeat && repeat !== "off" && <span className="ypm-seg-dot" aria-hidden="true" />}
          </button>

          {/* Segmen 6: Volume dengan bar vertikal */}
          <div
            ref={volRef}
            className="ypm-vol-wrap hidden sm:block"
            onWheel={(e) => {
              e.preventDefault();
              const nextV = Math.min(1, Math.max(0, volVal - e.deltaY / 1000));
              setVolume?.(nextV);
            }}
          >
            {volOpen && (
              <div className="ypm-vol-pop" role="dialog" aria-label="Pengaturan volume">
                <span className="ypm-vol-pct">{Math.round(volVal * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volVal}
                  onChange={(e) => setVolume?.(Number(e.target.value))}
                  aria-label="Volume"
                  className="ypm-vol-vrange"
                />
              </div>
            )}
            <button
              type="button"
              className="ypm-seg ypm-seg-icon"
              onClick={() => setVolOpen((v) => !v)}
              onDoubleClick={toggleMute}
              data-active={volOpen ? "1" : undefined}
              aria-expanded={volOpen}
              aria-label={muted || volVal === 0 ? "Volume senyap" : `Volume ${Math.round(volVal * 100)}%`}
              title="Volume (gulir atau klik)"
            >
              {muted || volVal === 0 ? (
                <IconVolumeMute className="h-5 w-5" />
              ) : (
                <IconVolume className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Segmen 7: Queue Drawer & CoverFlow */}
          <button
            type="button"
            className="ypm-seg ypm-seg-icon"
            onClick={() => onToggleRight?.("queue")}
            data-active={rightOpen ? "1" : undefined}
            aria-pressed={!!rightOpen}
            aria-label="Panel antrean"
            title="Antrean (Q)"
          >
            <IconQueue className="h-5 w-5" />
            {rightOpen && <span className="ypm-seg-dot" aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="ypm-seg ypm-seg-icon hidden xl:inline-flex"
            onClick={onOpenCoverFlow}
            aria-label="Buka Cover Flow"
            title="Cover Flow"
          >
            <IconDisc className="h-5 w-5" />
          </button>
        </div>
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
