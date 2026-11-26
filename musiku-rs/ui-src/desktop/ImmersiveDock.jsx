// Bottom bar Playing Screen 100% mengikuti YesPlayMusic (lib/pages/now_playing.dart _BottomBar):
// Tinggi 72px, border-radius 24px, gap 8px:
// [Collapse 58px] [Progress Penuh Putih + Timer Dual-Layer] [Shuffle 58px]
// [WhiteControls 174px: Prev/Play/Next] [Repeat 58px] [Heart 58px] [Volume 58px] [More 58px]
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import {
  IconEllipsis,
  IconHeart,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
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

function IconChevronDown({ className = "h-6 w-6" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export const ImmersiveDock = memo(function ImmersiveDock({
  onExit,
  onOpenMenu,
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

  const scrubRef = useRef(null);
  const fillRef = useRef(null);
  const darkLayerRef = useRef(null);
  const hoverFillRef = useRef(null);
  const hoverLineRef = useRef(null);
  const elWhiteRef = useRef(null);
  const elDarkRef = useRef(null);
  const durWhiteRef = useRef(null);
  const durDarkRef = useRef(null);
  const volBarRef = useRef(null);

  const [volOpen, setVolOpen] = useState(false);
  const volDragging = useRef(false);

  const anchor = useRef({ pos: p.position, ts: performance.now(), playing });
  const drag = useRef({ on: false, ratio: 0 });
  const hoverRatio = useRef(null);
  const raf = useRef(0);
  const lastSec = useRef(-1);
  const hiddenRef = useRef(
    typeof document !== "undefined" && document.visibilityState === "hidden"
  );
  const seekRef = useRef(seek);
  seekRef.current = seek;

  const shouldAnimate = useCallback(
    () => !hiddenRef.current && (anchor.current.playing || drag.current.on),
    []
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
      const pct = ratio * 100;

      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`;
      }
      if (darkLayerRef.current) {
        darkLayerRef.current.style.clipPath = `inset(0 ${Math.max(0, 100 - pct)}% 0 0)`;
      }

      // Preview fill saat pointer melayang di atas scrubber
      const hr = hoverRatio.current;
      if (hoverFillRef.current && hoverLineRef.current) {
        if (hr !== null && !drag.current.on) {
          hoverLineRef.current.style.opacity = "1";
          hoverLineRef.current.style.left = `${hr * 100}%`;
          if (hr > ratio) {
            hoverFillRef.current.style.opacity = "1";
            hoverFillRef.current.style.left = `${pct}%`;
            hoverFillRef.current.style.width = `${(hr - ratio) * 100}%`;
          } else {
            hoverFillRef.current.style.opacity = "0";
          }
        } else {
          hoverFillRef.current.style.opacity = "0";
          hoverLineRef.current.style.opacity = "0";
        }
      }

      const sec = Math.floor(pos);
      if (sec !== lastSec.current) {
        lastSec.current = sec;
        const txt = fmt(sec);
        if (elWhiteRef.current) elWhiteRef.current.textContent = txt;
        if (elDarkRef.current) elDarkRef.current.textContent = txt;
      }
      if (shouldAnimate()) {
        raf.current = requestAnimationFrame(paint);
      }
    },
    [duration, shouldAnimate]
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
    const durTxt = fmt(duration);
    if (durWhiteRef.current) durWhiteRef.current.textContent = durTxt;
    if (durDarkRef.current) durDarkRef.current.textContent = durTxt;
  }, [duration]);

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

  if (!current) return null;

  const ratioAt = (clientX) => {
    const r = scrubRef.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const startScrub = (e) => {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { on: true, ratio: ratioAt(e.clientX) };
    kick();
  };

  const moveScrub = (e) => {
    const r = ratioAt(e.clientX);
    hoverRatio.current = r;
    if (drag.current.on) {
      drag.current.ratio = r;
    }
    kick();
  };

  const endScrub = (e) => {
    if (!drag.current.on) return;
    drag.current.on = false;
    const t = ratioAt(e.clientX) * duration;
    anchor.current = { pos: t, ts: performance.now(), playing };
    seekRef.current(t);
    kick();
  };

  const setVolFromPointer = (clientY) => {
    const rect = volBarRef.current?.getBoundingClientRect();
    if (!rect || !rect.height) return;
    const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setVolume(v);
  };

  const vol = muted ? 0 : volume;
  const liked = isLiked?.(current.videoId);
  const repeatOn = repeat !== "off";
  const repeatLabel =
    repeat === "one"
      ? "Ulangi satu lagu"
      : repeat === "all"
        ? "Ulangi semua lagu"
        : "Mode ulang mati";

  return (
    <footer className="ypm-np-bottom" aria-label="Kontrol pemutar">
      {/* 1. Collapse (Tutup Now Playing di ujung kiri seperti YesPlayMusic v33) */}
      <button
        type="button"
        onClick={onExit}
        aria-label="Tutup layar pemutar"
        title="Tutup (Esc)"
        className="ypm-np-seg"
      >
        <IconChevronDown className="h-6 w-6" />
      </button>

      {/* 2. Progress Scrubber Penuh 72px dengan dual-layer timestamp putih/hitam */}
      <div
        ref={scrubRef}
        role="slider"
        tabIndex={0}
        aria-label="Posisi lagu"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration || 0)}
        aria-valuenow={Math.floor(p.position || 0)}
        onPointerDown={startScrub}
        onPointerMove={moveScrub}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onPointerLeave={() => {
          hoverRatio.current = null;
          kick();
        }}
        onKeyDown={(e) => {
          if (!duration) return;
          if (e.key === "ArrowRight") seek(Math.min(duration, p.position + 5));
          if (e.key === "ArrowLeft") seek(Math.max(0, p.position - 5));
        }}
        className="ypm-np-progress"
      >
        <div ref={fillRef} className="ypm-np-progress-fill" />
        <div ref={hoverFillRef} className="ypm-np-progress-hover" />
        <div ref={hoverLineRef} className="ypm-np-progress-line" />

        {/* Layer bawah: angka putih */}
        <div className="ypm-np-progress-labels is-light" aria-hidden="true">
          <span ref={elWhiteRef}>{fmt(p.position)}</span>
          <span ref={durWhiteRef}>{fmt(duration)}</span>
        </div>

        {/* Layer atas: angka hitam terpotong tepat di batas bar putih */}
        <div
          ref={darkLayerRef}
          className="ypm-np-progress-labels is-dark"
          aria-hidden="true"
        >
          <span ref={elDarkRef}>{fmt(p.position)}</span>
          <span ref={durDarkRef}>{fmt(duration)}</span>
        </div>
      </div>

      {/* 3. Shuffle */}
      <button
        type="button"
        onClick={toggleShuffle}
        aria-label="Acak antrean"
        aria-pressed={shuffle}
        title="Acak"
        className={`ypm-np-seg ${shuffle ? "is-accent" : ""}`}
      >
        <IconShuffle className="h-6 w-6" />
        <span className={`ypm-np-dot ${shuffle ? "is-on" : ""}`} />
      </button>

      {/* 4. _WhiteControls: kapsul putih solid 174x72 dengan ikon gelap */}
      <div className="ypm-np-white-ctrl">
        <button
          type="button"
          onClick={prev}
          aria-label="Lagu sebelumnya"
          title="Sebelumnya"
          className="ypm-np-wbtn"
        >
          <IconPrev className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Jeda" : "Putar"}
          title={playing ? "Jeda" : "Putar"}
          className="ypm-np-wbtn"
        >
          {playing ? (
            <IconPause className="h-9 w-9" />
          ) : (
            <IconPlay className="h-9 w-9" />
          )}
        </button>
        <button
          type="button"
          onClick={next}
          disabled={queue.length <= 1 && repeat === "off"}
          aria-label="Lagu berikutnya"
          title="Berikutnya"
          className="ypm-np-wbtn"
        >
          <IconNext className="h-7 w-7" />
        </button>
      </div>

      {/* 5. Repeat */}
      <button
        type="button"
        onClick={cycleRepeat}
        aria-label={repeatLabel}
        aria-pressed={repeatOn}
        title={repeatLabel}
        className={`ypm-np-seg ${repeatOn ? "is-active-white" : "is-dim"}`}
      >
        {repeat === "one" ? (
          <IconRepeatOne className="h-6 w-6" />
        ) : (
          <IconRepeat className="h-6 w-6" />
        )}
        <span className={`ypm-np-dot ${repeatOn ? "is-on" : ""}`} />
      </button>

      {/* 6. Heart */}
      <button
        type="button"
        onClick={() => toggleLike?.(current)}
        aria-label={liked ? "Hapus dari disukai" : "Sukai lagu ini"}
        aria-pressed={liked}
        title={liked ? "Hapus dari disukai" : "Sukai"}
        className={`ypm-np-seg ${liked ? "is-heart" : ""}`}
      >
        <IconHeart className="h-6 w-6" filled={liked} />
      </button>

      {/* 7. Vertical Volume Segment (mengembang ke atas saat hover, mirip YesPlayMusic VolumeSeg) */}
      <div
        className="ypm-np-vol-wrap"
        onMouseEnter={() => setVolOpen(true)}
        onMouseLeave={() => {
          if (!volDragging.current) setVolOpen(false);
        }}
      >
        {volOpen && (
          <div className="ypm-np-vol-pop">
            <div
              ref={volBarRef}
              role="slider"
              tabIndex={0}
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(vol * 100)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                volDragging.current = true;
                setVolFromPointer(e.clientY);
              }}
              onPointerMove={(e) => {
                if (volDragging.current) setVolFromPointer(e.clientY);
              }}
              onPointerUp={() => {
                volDragging.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") setVolume(Math.min(1, vol + 0.05));
                if (e.key === "ArrowDown") setVolume(Math.max(0, vol - 0.05));
              }}
              className="ypm-np-vol-rail"
            >
              <div
                className="ypm-np-vol-fill"
                style={{ height: `${Math.round(vol * 100)}%` }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Aktifkan suara" : "Bisukan suara"}
          title={`Volume ${Math.round(vol * 100)}%`}
          className="ypm-np-seg"
        >
          {muted || vol === 0 ? (
            <IconVolumeMute className="h-6 w-6" />
          ) : (
            <IconVolume className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* 8. More */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Opsi lagu lainnya"
        title="Lainnya"
        className="ypm-np-seg"
      >
        <IconEllipsis className="h-6 w-6" />
      </button>
    </footer>
  );
});
