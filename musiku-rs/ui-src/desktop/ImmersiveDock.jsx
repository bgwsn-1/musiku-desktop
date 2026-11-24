// Kapsul kontrol mengambang di bawah mode imersif:
// Kiri: shuffle, prev, play/pause, next, repeat, timer (elapsed / -remaining)
// Tengah: kotak info lagu + aksi suka/menu + scrub bar di tepi bawah
// Kanan: volume popover, toggle antrean, toggle lirik, jeda motion art, keluar
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { LiquidGlass } from "@/components/ui/apple-tahoe-liquid-glass-button";
import {
  IconEllipsis,
  IconHeart,
  IconLyrics,
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

function IconCollapse({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
    </svg>
  );
}

function IconMotion({ paused, className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      {paused ? <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" /> : <path d="M10 9v6M14 9v6" />}
    </svg>
  );
}

export const ImmersiveDock = memo(function ImmersiveDock({
  rightView,
  onToggleLyrics,
  onToggleQueue,
  hasMotion,
  motionPaused,
  onToggleMotion,
  onOpenMenu,
  onExit,
}) {
  const p = usePlayer();
  const {
    current,
    queue,
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

  const [volOpen, setVolOpen] = useState(false);
  const volWrapRef = useRef(null);
  const scrubRef = useRef(null);
  const fillRef = useRef(null);
  const timeRef = useRef(null);
  const anchor = useRef({ pos: p.position, ts: performance.now(), playing });
  const drag = useRef({ on: false, ratio: 0 });
  const raf = useRef(0);
  const lastSec = useRef(-1);
  const hiddenRef = useRef(
    typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  const seekRef = useRef(seek);
  seekRef.current = seek;

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
        if (timeRef.current) {
          const rem = d ? `-${fmt(Math.max(0, Math.ceil(d - pos)))}` : "-0:00";
          timeRef.current.textContent = `${fmt(sec)} / ${rem}`;
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

  // Tutup popover volume saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!volOpen) return;
    const onDown = (e) => {
      if (!volWrapRef.current?.contains(e.target)) setVolOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setVolOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [volOpen]);

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
    seekRef.current(nextPos);
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
    seekRef.current(nextPos);
    anchor.current = { pos: nextPos, ts: performance.now(), playing };
    kick();
  };

  const artistText = current.artist || current.artists?.[0] || "";
  const subParts = [current.album, artistText].filter(Boolean);
  const subtitle = subParts.join(" · ");
  const liked = isLiked?.(current.videoId) ?? false;
  const queueCount = Array.isArray(queue) ? queue.length : 0;
  const repeatLabel =
    repeat === "one"
      ? "Ulangi satu lagu"
      : repeat === "all"
        ? "Ulangi semua"
        : "Ulangi mati";
  const volPct = Math.round((muted ? 0 : volume ?? 1) * 100);

  return (
    <div className="im-dock-wrap">
      <LiquidGlass
        material="regular"
        appearance="dark"
        refraction={18}
        bezel={24}
        blur={1.5}
        fallbackBlur={24}
        saturation={1.35}
        brightness={1.02}
        interactive={false}
        role="region"
        aria-label="Kontrol pemutar imersif"
        className="im-dock"
      >
        <div className="im-dock-left">
          <button
            type="button"
            className="im-dock-btn"
            onClick={toggleShuffle}
            data-active={shuffle ? "1" : undefined}
            aria-pressed={!!shuffle}
            aria-label={shuffle ? "Matikan acak" : "Aktifkan acak"}
            title={shuffle ? "Acak aktif" : "Acak"}
          >
            <IconShuffle className="h-[17px] w-[17px]" />
          </button>

          <button
            type="button"
            className="im-dock-btn"
            onClick={prev}
            aria-label="Lagu sebelumnya"
            title="Lagu sebelumnya"
          >
            <IconPrev className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            className="im-dock-btn im-dock-btn-play"
            onClick={toggle}
            aria-label={playing ? "Jeda" : "Putar"}
            title={playing ? "Jeda (Space)" : "Putar (Space)"}
          >
            {playing ? (
              <IconPause className="h-[18px] w-[18px]" />
            ) : (
              <IconPlay className="h-[18px] w-[18px]" />
            )}
          </button>

          <button
            type="button"
            className="im-dock-btn"
            onClick={next}
            aria-label="Lagu berikutnya"
            title="Lagu berikutnya"
          >
            <IconNext className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            className="im-dock-btn"
            onClick={cycleRepeat}
            data-active={repeat && repeat !== "off" ? "1" : undefined}
            aria-pressed={!!(repeat && repeat !== "off")}
            aria-label={repeatLabel}
            title={repeatLabel}
          >
            {repeat === "one" ? (
              <IconRepeatOne className="h-[17px] w-[17px]" />
            ) : (
              <IconRepeat className="h-[17px] w-[17px]" />
            )}
          </button>

          <span ref={timeRef} className="im-dock-time" aria-hidden="true">
            0:00 / -0:00
          </span>
        </div>

        <div className="im-dock-track">
          <div className="im-dock-track-text">
            <p className="im-dock-track-title">{current.title || "Lagu tanpa judul"}</p>
            {subtitle && <p className="im-dock-track-sub">{subtitle}</p>}
          </div>

          <div className="im-dock-track-actions">
            <button
              type="button"
              className="im-dock-mini"
              data-liked={liked ? "1" : undefined}
              onClick={() => toggleLike?.(current)}
              aria-pressed={liked}
              aria-label={liked ? "Hapus dari disukai" : "Sukai lagu"}
              title={liked ? "Disukai" : "Sukai"}
            >
              <IconHeart filled={liked} className="h-[15px] w-[15px]" />
            </button>

            <button
              type="button"
              className="im-dock-mini"
              onClick={onOpenMenu}
              aria-haspopup="menu"
              aria-label="Opsi lagu lainnya"
              title="Opsi lainnya"
            >
              <IconEllipsis className="h-[16px] w-[16px]" />
            </button>
          </div>

          <div
            ref={scrubRef}
            className="im-dock-scrub"
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
            <div className="im-dock-scrub-rail">
              <div ref={fillRef} className="im-dock-scrub-fill" />
            </div>
          </div>
        </div>

        <div className="im-dock-right">
          <div ref={volWrapRef} className="im-vol-wrap">
            <button
              type="button"
              className="im-dock-btn"
              onClick={() => setVolOpen((v) => !v)}
              onDoubleClick={toggleMute}
              data-active={volOpen ? "1" : undefined}
              aria-expanded={volOpen}
              aria-label={muted || volPct === 0 ? "Volume senyap" : `Atur volume (${volPct}%)`}
              title="Volume"
            >
              {muted || volPct === 0 ? (
                <IconVolumeMute className="h-[17px] w-[17px]" />
              ) : (
                <IconVolume className="h-[17px] w-[17px]" />
              )}
            </button>

            {volOpen && (
              <div className="im-vol-pop" role="dialog" aria-label="Pengaturan volume">
                <button
                  type="button"
                  className="im-dock-mini"
                  onClick={toggleMute}
                  aria-label={muted ? "Bunyikan suara" : "Bisukan suara"}
                >
                  {muted || volPct === 0 ? (
                    <IconVolumeMute className="h-4 w-4" />
                  ) : (
                    <IconVolume className="h-4 w-4" />
                  )}
                </button>
                <label htmlFor="im-vol-slider" className="sr-only">
                  Volume
                </label>
                <input
                  id="im-vol-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume ?? 1}
                  onChange={(e) => setVolume?.(Number(e.target.value))}
                  className="im-vol-range"
                />
                <span className="im-vol-val">{volPct}%</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="im-dock-btn"
            onClick={onToggleQueue}
            data-active={rightView === "queue" ? "1" : undefined}
            aria-pressed={rightView === "queue"}
            aria-label={`Antrean (${queueCount} lagu)`}
            title="Antrean"
          >
            <IconQueue className="h-[17px] w-[17px]" />
            {queueCount > 0 && (
              <span className="im-dock-badge" aria-hidden="true">
                {queueCount > 99 ? "99" : queueCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className="im-dock-btn"
            onClick={onToggleLyrics}
            data-active={rightView === "lyrics" ? "1" : undefined}
            aria-pressed={rightView === "lyrics"}
            aria-label={rightView === "lyrics" ? "Sembunyikan lirik" : "Tampilkan lirik"}
            title="Lirik"
          >
            <IconLyrics className="h-[17px] w-[17px]" />
          </button>

          {hasMotion && (
            <button
              type="button"
              className="im-dock-btn"
              onClick={onToggleMotion}
              data-active={motionPaused ? undefined : "1"}
              aria-pressed={!motionPaused}
              aria-label={motionPaused ? "Putar animasi sampul" : "Jeda animasi sampul"}
              title={motionPaused ? "Putar animasi sampul" : "Jeda animasi sampul"}
            >
              <IconMotion paused={motionPaused} className="h-[17px] w-[17px]" />
            </button>
          )}

          <button
            type="button"
            className="im-dock-btn"
            onClick={onExit}
            aria-label="Keluar mode imersif"
            title="Keluar mode imersif (Esc)"
          >
            <IconCollapse className="h-[16px] w-[16px]" />
          </button>
        </div>
      </LiquidGlass>
    </div>
  );
});
