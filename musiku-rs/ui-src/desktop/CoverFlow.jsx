// Cover Flow — HANYA bundle desktop (Windows/Linux).
// Web/Android memakai stub di src/components/CoverFlow.tsx.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { AuroraBackground } from "@/components/AuroraBackground";
import { IconClose } from "@/components/Icons";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import { CF_LAYOUT, CF_MOTION, CF_FX, clamp } from "./coverFlowMath";
import { useCoverFlowMotion } from "./useCoverFlowMotion";
import { useAppleArtwork } from "./useAppleArtwork";
import { CoverItem } from "./CoverItem";
import { CoverFlowBottom } from "./CoverFlowBottom";

export function CoverFlow({ onExit }) {
  const p = usePlayer();
  const queue = useMemo(
    () => (p.queue?.length ? p.queue : p.current ? [p.current] : []),
    [p.queue, p.current],
  );
  const [active, setActive] = useState(() => clamp(p.index, 0, Math.max(0, queue.length - 1)));
  const [menu, setMenu] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [trackPulse, setTrackPulse] = useState(0);
  const auroraRef = useRef(null);
  const stageRef = useRef(null);
  const motion = useCoverFlowMotion(queue.length);
  const activeTrack = queue[active] || p.current;
  const art = useAppleArtwork(activeTrack);

  // Ref selalu segar: dipakai timer debounce & efek player tanpa re-register.
  const playerRef = useRef({ index: p.index, videoId: p.current?.videoId });
  playerRef.current = { index: p.index, videoId: p.current?.videoId };
  const playerIndexRef = useRef(p.index);
  const seekTimer = useRef(null);
  const externalDuringDrag = useRef(null);

  // Player punya `recent` (riwayat, terbaru duluan). Pakai hanya kalau kita
  // berada di track pertama antrian; kalau kosong, sisi kiri dibiarkan kosong.
  const historyTrack = useMemo(() => {
    if (active !== 0 || !p.recent?.length || !activeTrack) return null;
    return p.recent.find((r) => r.videoId !== activeTrack.videoId) || null;
  }, [active, p.recent, activeTrack?.videoId]);

  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const cancelSeek = useCallback(() => {
    if (seekTimer.current) clearTimeout(seekTimer.current);
    seekTimer.current = null;
  }, []);

  const exit = useCallback(() => {
    cancelSeek();
    onExitRef.current?.();
  }, [cancelSeek]);

  // Gerakan visual saja — tidak menyentuh player.
  const jump = useCallback(
    (i) => {
      const next = clamp(i, 0, Math.max(0, queue.length - 1));
      setActive(next);
      motion.goTo(next);
      return next;
    },
    [queue.length, motion],
  );

  // Satu-satunya jalur yang menyuruh player berpindah trek.
  const playIndex = useCallback(
    (i) => {
      const next = clamp(i, 0, Math.max(0, queue.length - 1));
      cancelSeek();
      if (next === playerRef.current.index) return; // jangan restart lagu yang sama
      playerIndexRef.current = next;
      p.jumpTo(next);
    },
    [cancelSeek, p.jumpTo, queue.length],
  );

  // Geser bebas → putar setelah diam ~300ms. Cover yang dilewati tidak diputar.
  const scheduleSeek = useCallback(
    (i) => {
      cancelSeek();
      const next = clamp(i, 0, Math.max(0, queue.length - 1));
      seekTimer.current = setTimeout(() => {
        seekTimer.current = null;
        if (motion.dragging.current) return;
        playIndex(next);
      }, CF_FX.seekDebounceMs);
    },
    [cancelSeek, motion, playIndex, queue.length],
  );

  const browse = useCallback(
    (i) => {
      const next = jump(i);
      scheduleSeek(next);
    },
    [jump, scheduleSeek],
  );

  // Perubahan dari player (next/prev bawah, auto-next): carousel ikut.
  // Tidak memanggil play lagi; pending debounce milik user dibatalkan.
  useEffect(() => {
    if (p.index < 0 || p.index >= queue.length) return;
    if (motion.dragging.current) {
      externalDuringDrag.current = p.index;
      playerIndexRef.current = p.index;
      return;
    }
    if (p.index === playerIndexRef.current) return;
    playerIndexRef.current = p.index;
    cancelSeek();
    jump(p.index);
  }, [p.index, queue.length, motion, jump, cancelSeek]);

  useEffect(() => {
    const next = clamp(active, 0, Math.max(0, queue.length - 1));
    if (next !== active) jump(next);
  }, [queue.length, active, jump]);

  useEffect(() => {
    motion.sync();
  }, [active, queue, motion, historyTrack?.videoId]);

  // Aurora mengikuti cover tengah, di-debounce supaya tidak crossfade terus.
  useEffect(() => {
    if (!activeTrack) return;
    const id = setTimeout(() => {
      auroraRef.current?.setCover(art.still || activeTrack.thumbs || null);
    }, CF_MOTION.auroraMs);
    return () => clearTimeout(id);
  }, [active, activeTrack?.videoId, activeTrack?.thumbs, art.ready, art.still]);

  // Pulse khusus efek: naik hanya saat trek player berubah (bukan saat browse).
  useEffect(() => {
    setTrackPulse((n) => n + 1);
  }, [p.index]);

  // Timer debounce ikut mati saat overlay ditutup / komponen unmount.
  useEffect(() => cancelSeek, [cancelSeek]);

  const select = useCallback(
    (i) => {
      cancelSeek();
      if (i === active) {
        const tr = queue[active];
        if (!tr) return;
        if (p.current?.videoId === tr.videoId) p.toggle();
        else playIndex(active);
        return;
      }
      jump(i);
      playIndex(i); // klik samping langsung putar trek itu
    },
    [active, queue, p.current?.videoId, p.toggle, cancelSeek, playIndex, jump],
  );

  const playCenter = useCallback(() => select(active), [select, active]);

  const openMenu = useCallback((i, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ anchor: { x: r.right, y: r.bottom + 4, end: true }, track: null, index: i });
  }, []);
  const menuTrack = menu ? queue[menu.index] || p.current : null;

  // Tutup otomatis jika lebar jendela turun di bawah breakpoint `lg` (1024px)
  // agar overlay yang tersembunyi (`hidden lg:flex`) tidak tetap ter-mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => {
      if (!mq.matches) exit();
    };
    syncViewport();
    mq.addEventListener("change", syncViewport);
    return () => mq.removeEventListener("change", syncViewport);
  }, [exit]);

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const isEditable = (el) =>
      !!el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']") ||
      !!el?.isContentEditable;

    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
        return;
      }
      if (isEditable(e.target) || isEditable(document.activeElement)) return;
      if (e.key === "Escape") {
        if (document.querySelector("[role=menu]")) return; // bentrok dengan TrackMenu
        e.preventDefault();
        exit();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        browse(active + (e.key === "ArrowRight" ? 1 : -1));
        return;
      }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        browse(e.key === "Home" ? 0 : queue.length - 1);
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < queue.length) {
          e.preventDefault();
          browse(i);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (document.activeElement?.closest?.("button, [role=slider]")) return;
        e.preventDefault();
        playCenter();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, queue.length, browse, playCenter, exit]);

  // ── Wheel / trackpad: satu langkah per throttle ───────────────────────
  const wheelAt = useRef(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 4) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt.current < CF_MOTION.wheelMs) return;
      wheelAt.current = now;
      browse(active + (d > 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [active, browse]);

  // ── Drag pointer dengan inersia ringan ────────────────────────────────
  const drag = useRef({ on: false, x: 0, start: 0, lastX: 0, lastT: 0, v: 0, moved: 0 });
  const suppressClick = useRef(false);
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const now = performance.now();
    drag.current = {
      on: true,
      x: e.clientX,
      start: motion.pos.current,
      lastX: e.clientX,
      lastT: now,
      v: 0,
      moved: 0,
    };
    motion.dragging.current = true;
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.x;
    d.moved = Math.max(d.moved, Math.abs(dx));
    const now = performance.now();
    d.v = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    motion.setPos(d.start - dx / CF_LAYOUT.spacingNear);
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    motion.dragging.current = false;
    externalDuringDrag.current = null; // keputusan user setelah drag yang menang
    if (d.moved < 6) return;
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const bias = clamp(
      (-d.v * 1000 * CF_MOTION.inertiaSec) / CF_LAYOUT.spacingNear,
      -0.65,
      0.65,
    );
    browse(Math.round(motion.pos.current + bias));
  };

  // Tanpa pointer capture: klik tombol cover tetap sampai, drag tetap jalan
  // walau pointer keluar dari stage.
  const moveRef = useRef(null);
  const upRef = useRef(null);
  moveRef.current = onPointerMove;
  upRef.current = onPointerUp;
  useEffect(() => {
    const move = (e) => moveRef.current?.(e);
    const up = () => upRef.current?.();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  if (!queue.length) return null;

  const start = Math.max(0, active - CF_LAYOUT.radius);
  const end = Math.min(queue.length - 1, active + CF_LAYOUT.radius);
  const visible = [];
  for (let i = start; i <= end; i++) visible.push(i);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Cover Flow"
      className="cf-root force-dark dialog-in fixed inset-0 z-[70] hidden overflow-hidden bg-window lg:flex"
      style={{
        "--cf-pop-ms": `${CF_FX.popMs}ms`,
        "--cf-pop-scale": CF_FX.popScale,
        "--cf-caption-ms": `${CF_FX.captionMs}ms`,
        "--cf-caption-shift": `${CF_FX.captionShiftPx}px`,
        "--cf-press-scale": CF_FX.pressScale,
        "--cf-pause-scale": CF_FX.pauseScale,
        "--cf-playpause-ms": `${CF_FX.playPauseMs}ms`,
        "--cf-icon-ms": `${CF_FX.iconMs}ms`,
      }}
    >
      <AuroraBackground ref={auroraRef} />
      <div className="cf-scrim" aria-hidden="true" />

      <button
        onClick={exit}
        className="cf-exit glass-btn"
        aria-label="Keluar Cover Flow"
        title="Keluar Cover Flow (Esc)"
      >
        <IconClose className="h-5 w-5" />
      </button>

      <div
        ref={stageRef}
        className="cf-stage"
        onPointerDown={onPointerDown}
      >
        <div className="cf-track" role="group" aria-label="Cover album">
          {historyTrack && (
            <CoverItem
              key={`history-${historyTrack.videoId}`}
              track={historyTrack}
              index={-1}
              active={false}
              history
              showLabel={CF_LAYOUT.labelDistance >= 1}
              src={historyTrack.thumbs}
              register={motion.register}
              onSelect={() => {}}
              onMenu={openMenu}
            />
          )}
          {visible.map((i) => (
            <CoverItem
              key={`${queue[i].videoId}-${i}`}
              track={queue[i]}
              index={i}
              active={i === active}
              showLabel={Math.abs(i - active) <= CF_LAYOUT.labelDistance}
              pulse={trackPulse}
              captionKey={i === active ? `play-${p.index}` : i}
              playing={p.playing}
              src={i === active ? art.still || queue[i].thumbs : queue[i].thumbs}
              register={motion.register}
              onSelect={(idx) => {
                if (!suppressClick.current) select(idx);
              }}
              onMenu={openMenu}
            />
          ))}
        </div>
      </div>

      <CoverFlowBottom />

      {menuTrack && (
        <TrackMenu
          track={menuTrack}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          onAddToPlaylist={() => setAddOpen(true)}
        />
      )}
      {addOpen && menuTrack && (
        <AddToPlaylistMenu track={menuTrack} onClose={() => setAddOpen(false)} />
      )}
    </div>
  );
}
