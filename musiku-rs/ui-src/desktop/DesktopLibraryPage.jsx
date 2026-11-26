// Halaman Pustaka desktop 100% mengikuti YesPlayMusic (lib/pages/library.dart):
// - Tab atas: Lagu <n>, Album <n>, Playlist <n>, Artis <n> + Sort (Judul A-Z / Terbaru) + Coverflow.
// - Tab Album (default): Record Shelf piringan hitam vertikal (spine berwarna diekstrak dari cover)
//   dengan kartu tengah tertarik keluar (420x548), drag/wheel/keyboard, dan Water-Column Timeline canvas.
// - Tab Lagu: tombol Putar/Acak + daftar lagu disukai & baru diputar.
// - Tab Playlist: grid 4 kolom kartu squircle berwarna sampul (314px) + Buat Playlist baru.
// - Tab Artis: Spiral Artist Bubble Cloud (diameter 96..184px sesuai jumlah lagu).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconClose,
  IconDisc,
  IconEllipsis,
  IconHeart,
  IconMusic,
  IconPause,
  IconPlay,
  IconPlus,
  IconShuffle,
} from "@/components/Icons";
import { fallbackForKey, useCoverPalettes } from "./coverColor.js";

function shuffleTracks(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function spineWidthFor(key) {
  let h = 0;
  const s = String(key || "");
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return 52 + (Math.abs(h) % 10); // 52..61px seperti variasi ketebalan piringan YesPlayMusic
}

function formatCount(n) {
  return n < 1000 ? String(n) : n.toLocaleString("en-US");
}

function durationToSecs(d) {
  if (typeof d === "number" && Number.isFinite(d) && d > 0) return d;
  if (typeof d === "string") {
    const p = d.split(":").map(Number);
    if (p.length === 2 && p.every(Number.isFinite)) return p[0] * 60 + p[1];
    if (p.length === 3 && p.every(Number.isFinite)) return p[0] * 3600 + p[1] * 60 + p[2];
  }
  return 0;
}

function formatHours(totalSec) {
  if (!totalSec) return "";
  const mins = Math.round(totalSec / 60);
  if (mins < 60) return `${mins} mnt`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`;
}

function artistTextOf(t) {
  if (Array.isArray(t.artists)) return t.artists.filter(Boolean).join(", ");
  return t.artists || t.artist || "Artis tidak diketahui";
}

function albumNameOf(t) {
  if (typeof t.album === "string" && t.album.trim()) return t.album.trim();
  if (t.album && typeof t.album === "object" && t.album.name) return t.album.name;
  return "";
}

// =========================================================================
// Water-Column Timeline Canvas (Port 1:1 YesPlayMusic TicksPainter)
// =========================================================================
const TICK_STEP = 11.5;
const TL_LABEL = 14;
const TL_ARROW = 6;
const TL_GAP = 6;
const TL_COL = 20;
const TL_BASE = TL_LABEL + TL_ARROW + TL_GAP + TL_COL; // 46
const TL_HEIGHT = TL_BASE + 26; // 72

function ShelfTimeline({ albums, currentIndex, sortMode, onPick }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const animCurX = useRef(0);
  const targetCurX = useRef(0);
  const hoverIdx = useRef(-1);
  const hoverT = useRef(0);
  const targetHoverT = useRef(0);
  const dragging = useRef(false);
  const rafRef = useRef(0);

  const count = albums.length;

  const marks = useMemo(() => {
    if (count === 0) return [];
    if (sortMode === 0) {
      // Judul A-Z: huruf awal unik
      const initialOf = (a) => {
        const ch = (a.title || "").trim().charAt(0).toUpperCase();
        return /^[A-Z]$/.test(ch) ? ch : "#";
      };
      const curInit = initialOf(albums[currentIndex] || albums[0]);
      const seen = new Set();
      const out = [];
      for (let i = 0; i < count; i++) {
        const ch = initialOf(albums[i]);
        if (!seen.has(ch)) {
          seen.add(ch);
          out.push({ pos: i, text: ch, strong: ch === curInit, level: 0 });
        }
      }
      return out;
    }
    // Terbaru: tahun rilis (atau nomor posisi bila tahun kosong)
    const curYear = albums[currentIndex]?.year || "";
    const out = [];
    for (let i = 0; i < count; i++) {
      const y = albums[i].year || "";
      if (!y) continue;
      if (i > 0 && albums[i - 1].year === y) continue;
      const yn = Number(y);
      out.push({
        pos: i,
        text: String(y),
        strong: y === curYear,
        level: yn % 10 === 0 ? 2 : yn % 5 === 0 ? 1 : 0,
      });
    }
    if (out.length === 0 && count > 1) {
      const step = Math.max(1, Math.floor(count / 6));
      for (let i = 0; i < count; i += step) {
        out.push({
          pos: i,
          text: String(i + 1),
          strong: i === currentIndex,
          level: 0,
        });
      }
    }
    return out;
  }, [albums, currentIndex, sortMode, count]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || count === 0) return;

    const w = wrap.clientWidth;
    if (w <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(TL_HEIGHT * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(TL_HEIGHT * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${TL_HEIGHT}px`;
    }

    const maxIdx = Math.max(1, count - 1);
    const span = (w - 3) / maxIdx;
    targetCurX.current = currentIndex * span;

    // Smooth lerp animCurX & hoverT
    animCurX.current += (targetCurX.current - animCurX.current) * 0.22;
    if (Math.abs(targetCurX.current - animCurX.current) < 0.25) {
      animCurX.current = targetCurX.current;
    }
    hoverT.current += (targetHoverT.current - hoverT.current) * 0.28;
    if (Math.abs(targetHoverT.current - hoverT.current) < 0.01) {
      hoverT.current = targetHoverT.current;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, TL_HEIGHT);

    const n = Math.floor((w - 3) / TICK_STEP);
    const curX = animCurX.current;
    const ci = Math.max(0, Math.min(n, Math.round(curX / TICK_STEP)));
    const cx = ci * TICK_STEP;
    const hi = hoverIdx.current;
    const ht = hoverT.current;

    // 1. Garis-garis water-column dengan tonjolan Gaussian
    for (let i = 0; i <= n; i++) {
      const x = i * TICK_STEP;
      const d = x - curX;
      let h = 5 + 15 * Math.exp(-(d * d) / (2 * 34 * 34));
      let a = 0.28;
      if (i === ci) {
        h = TL_COL;
        a = 1;
      } else if (i === hi && ht > 0.01) {
        h += (TL_COL - h) * ht;
        a += (0.6 - a) * ht;
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      const y = TL_BASE - h;
      ctx.beginPath();
      ctx.roundRect(x, y, 3, h, 1.5);
      ctx.fill();
    }

    // 2. Segitiga putih terbalik 10x6 di atas kolom aktif
    const triTip = TL_BASE - TL_COL - TL_GAP;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cx - 3.5, triTip - TL_ARROW);
    ctx.lineTo(cx + 6.5, triTip - TL_ARROW);
    ctx.lineTo(cx + 1.5, triTip);
    ctx.closePath();
    ctx.fill();

    // 3. Label hover di atas pointer
    if (ht > 0.02 && hi >= 0 && hi !== ci) {
      const nearest = Math.max(
        0,
        Math.min(count - 1, Math.round((hi * TICK_STEP) / span))
      );
      const alb = albums[nearest];
      if (alb) {
        const label =
          sortMode === 1 && alb.year
            ? `${alb.year} · ${alb.title}`
            : alb.title;
        ctx.font = '600 11px "Archivo", sans-serif';
        const text = label.length > 36 ? `${label.slice(0, 35)}...` : label;
        const tw = ctx.measureText(text).width;
        const hx = hi * TICK_STEP + 1.5;
        const lx = Math.max(0, Math.min(w - tw, hx - tw / 2));
        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * ht})`;
        ctx.fillText(text, lx, TL_LABEL - 2);
      }
    }

    // 4. Label bawah dengan penghindaran tabrakan
    const laid = marks.map((m) => {
      const x = (m.pos / maxIdx) * (w - 3);
      ctx.font = `${m.strong ? 700 : 600} 11px "Archivo", sans-serif`;
      const tw = ctx.measureText(m.text).width;
      const lx = Math.max(0, Math.min(w - tw, x - tw / 2 + 1.5));
      return { m, tw, lx };
    });

    laid.sort((a, b) => {
      if (a.m.strong !== b.m.strong) return a.m.strong ? -1 : 1;
      if (a.m.level !== b.m.level) return b.m.level - a.m.level;
      return a.m.pos - b.m.pos;
    });

    const placed = [];
    for (const item of laid) {
      const rx = item.lx + item.tw;
      if (placed.some(([p0, p1]) => item.lx < p1 + 10 && rx > p0 - 10)) continue;
      placed.push([item.lx, rx]);
      ctx.font = `${item.m.strong ? 700 : 600} 11px "Archivo", sans-serif`;
      ctx.fillStyle = item.m.strong
        ? "#ffffff"
        : "rgba(255, 255, 255, 0.4)";
      ctx.fillText(item.m.text, item.lx, TL_BASE + 19);
    }

    ctx.restore();

    if (
      Math.abs(targetCurX.current - animCurX.current) > 0.25 ||
      Math.abs(targetHoverT.current - hoverT.current) > 0.01
    ) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      rafRef.current = 0;
    }
  }, [albums, count, currentIndex, marks, sortMode]);

  const kick = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    kick();
  }, [currentIndex, albums, sortMode, kick]);

  useEffect(() => {
    const onResize = () => kick();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [kick]);

  const indexFromClientX = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || count <= 1) return 0;
    const x = Math.max(0, Math.min(rect.width - 3, clientX - rect.left));
    const span = (rect.width - 3) / (count - 1);
    return Math.max(0, Math.min(count - 1, Math.round(x / span)));
  };

  const updateHover = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const x = Math.max(0, Math.min(rect.width - 3, clientX - rect.left));
    const n = Math.floor((rect.width - 3) / TICK_STEP);
    hoverIdx.current = Math.max(0, Math.min(n, Math.round(x / TICK_STEP)));
    targetHoverT.current = 1;
    kick();
  };

  return (
    <div
      ref={wrapRef}
      className="ypm-shelf-timeline"
      onPointerMove={(e) => {
        updateHover(e.clientX);
        if (dragging.current) onPick(indexFromClientX(e.clientX));
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        onPick(indexFromClientX(e.clientX));
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerLeave={() => {
        dragging.current = false;
        targetHoverT.current = 0;
        kick();
      }}
    >
      <canvas ref={canvasRef} className="ypm-shelf-canvas" />
    </div>
  );
}

// =========================================================================
// Record Shelf (Port 1:1 YesPlayMusic _AlbumsBody + _CenterShelf + _ShelfItem)
// =========================================================================
function RecordShelf({ albums, sortMode }) {
  const router = useRouter();
  const { playTracks, enqueue } = usePlayer();
  const palettes = useCoverPalettes(albums);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [renderPos, setRenderPos] = useState(0);
  const [still, setStill] = useState(true);
  const [shelfW, setShelfW] = useState(1200);
  const [scale, setScale] = useState(1);
  const [menuId, setMenuId] = useState(null);

  const stageRef = useRef(null);
  const posRef = useRef(0);
  const velRef = useRef(0);
  const targetRef = useRef(0);
  const dragRef = useRef({ active: false, startX: 0, startPos: 0, lastX: 0, lastT: 0, vel: 0, moved: false });
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  const n = albums.length;

  useEffect(() => {
    const safe = Math.min(selectedIdx, Math.max(0, n - 1));
    setSelectedIdx(safe);
    targetRef.current = safe;
    posRef.current = safe;
    setRenderPos(safe);
    setMenuId(null);
  }, [sortMode, n]);

  // Hitung lebar panggung & skala proporsional tinggi viewport agar pas di atas MiniPlayer
  useEffect(() => {
    const syncSize = () => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const availH = Math.max(380, window.innerHeight - 235);
      const s = Math.max(0.62, Math.min(1.02, availH / 640));
      setScale(s);
      setShelfW(rect.width / s);
    };
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, []);

  const stepSpring = useCallback((now) => {
    if (!lastFrameRef.current) lastFrameRef.current = now;
    const dt = Math.min(0.032, Math.max(0.004, (now - lastFrameRef.current) / 1000));
    lastFrameRef.current = now;

    if (dragRef.current.active) {
      rafRef.current = 0;
      return;
    }

    const k = 220;
    const c = 28;
    const x = posRef.current - targetRef.current;
    const acc = -k * x - c * velRef.current;
    velRef.current += acc * dt;
    posRef.current += velRef.current * dt;

    if (Math.abs(x) < 0.0015 && Math.abs(velRef.current) < 0.01) {
      posRef.current = targetRef.current;
      velRef.current = 0;
      setRenderPos(targetRef.current);
      setStill(true);
      rafRef.current = 0;
      lastFrameRef.current = 0;
      return;
    }

    setRenderPos(posRef.current);
    rafRef.current = requestAnimationFrame(stepSpring);
  }, []);

  const goTo = useCallback(
    (idx) => {
      if (n === 0) return;
      const clamped = Math.max(0, Math.min(n - 1, idx));
      targetRef.current = clamped;
      setSelectedIdx(clamped);
      setMenuId(null);
      setStill(false);
      lastFrameRef.current = 0;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(stepSpring);
    },
    [n, stepSpring]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (
        document.activeElement &&
        ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(targetRef.current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(targetRef.current - 1);
      } else if (e.key === "Enter" && albums[targetRef.current]) {
        const cur = albums[targetRef.current];
        if (cur.browseId) router.push(`/album/${encodeURIComponent(cur.browseId)}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [albums, goTo, router]);

  const handlePlayAlbum = async (alb, shuffled = false) => {
    if (alb.tracks && alb.tracks.length > 0) {
      playTracks(shuffled ? shuffleTracks(alb.tracks) : alb.tracks, 0);
      return;
    }
    if (alb.browseId) {
      try {
        const r = await fetch(`/api/album/${encodeURIComponent(alb.browseId)}`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (d.tracks && d.tracks.length > 0) {
          playTracks(shuffled ? shuffleTracks(d.tracks) : d.tracks, 0);
          return;
        }
      } catch {
        // Fallback navigasi ke halaman album
      }
      router.push(`/album/${encodeURIComponent(alb.browseId)}`);
    }
  };

  const handleEnqueueAlbum = async (alb) => {
    setMenuId(null);
    if (alb.tracks && alb.tracks.length > 0) {
      alb.tracks.forEach((t) => enqueue(t));
      toast(`${alb.tracks.length} lagu ditambahkan ke antrean`);
      return;
    }
    if (alb.browseId) {
      try {
        const r = await fetch(`/api/album/${encodeURIComponent(alb.browseId)}`);
        if (r.ok) {
          const d = await r.json();
          if (d.tracks?.length) {
            d.tracks.forEach((t) => enqueue(t));
            toast(`${d.tracks.length} lagu ditambahkan ke antrean`);
          }
        }
      } catch {
        toast("Gagal memuat lagu album");
      }
    }
  };

  // Hitung layout _CenterShelf identik YesPlayMusic
  const layout = useMemo(() => {
    if (n === 0) return [];
    const widths = [];
    const heights = [];
    const opens = [];
    for (let i = 0; i < n; i++) {
      const o = Math.max(0, Math.min(1, 1 - Math.abs(i - renderPos)));
      opens.push(o);
      const sp = albums[i].spine;
      widths.push(sp + (420 - sp) * o + 16 * o);
      heights.push(512 + 36 * o);
    }
    const centers = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      centers.push(x + widths[i] / 2);
      x += widths[i] + 4;
    }
    let anchor = 0;
    if (n === 1) {
      anchor = centers[0] + renderPos * 48;
    } else {
      const lo = Math.max(0, Math.min(n - 2, Math.floor(renderPos)));
      anchor = centers[lo] + (centers[lo + 1] - centers[lo]) * (renderPos - lo);
    }
    const shift = shelfW / 2 - anchor;
    const items = [];
    let curX = 0;
    for (let i = 0; i < n; i++) {
      items.push({
        left: shift + curX,
        width: widths[i],
        height: heights[i],
        open: opens[i],
      });
      curX += widths[i] + 4;
    }
    return items;
  }, [albums, n, renderPos, shelfW]);

  const onPointerDown = (e) => {
    if (e.target.closest("button, a")) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startPos: posRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
      moved: false,
    };
    setStill(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 6) d.moved = true;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.vel = ((e.clientX - d.lastX) / dt) * 1000;
    d.lastX = e.clientX;
    d.lastT = now;

    const dragPx = 115 * scale;
    const nextPos = Math.max(-0.4, Math.min(n - 1 + 0.4, d.startPos - dx / dragPx));
    posRef.current = nextPos;
    setRenderPos(nextPos);
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    const dragPx = 115 * scale;
    const projected = posRef.current - (d.vel / dragPx) * 0.14;
    goTo(Math.round(projected));
  };

  const onWheel = (e) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 8) {
      e.preventDefault();
      goTo(targetRef.current + (delta > 0 ? 1 : -1));
    }
  };

  return (
    <div className="ypm-shelf-wrap" ref={stageRef}>
      <div
        className="ypm-shelf-scaler"
        style={{
          height: `${Math.round(548 * scale)}px`,
        }}
      >
        <div
          className="ypm-shelf-stage"
          style={{
            width: `${shelfW}px`,
            height: "548px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        >
          {albums.map((alb, i) => {
            const box = layout[i];
            if (!box) return null;
            // Cull item yang jauh di luar viewport agar sangat ringan
            if (box.left + box.width < -140 || box.left > shelfW + 140) return null;

            const o = box.open;
            const pal = palettes[alb.id] || fallbackForKey(alb.id || alb.title);
            const innerW = Math.max(1, box.width - 16 * o);
            const radius = 8 + 10 * o;
            const spineOp = o < 0.6 ? Math.max(0, 1 - o / 0.6) : 0;
            const cardOp = o > 0.4 ? Math.min(1, (o - 0.4) / 0.6) : 0;
            const isSelected = i === selectedIdx && still && o > 0.98;

            return (
              <div
                key={alb.id}
                className={`ypm-spine-slot ${o === 0 && still ? "is-hoverable" : ""}`}
                style={{
                  left: `${box.left + 8 * o}px`,
                  bottom: 0,
                  width: `${innerW}px`,
                  height: `${box.height}px`,
                  borderRadius: `${radius}px`,
                  backgroundColor: pal.card,
                  color: pal.onCard,
                  boxShadow:
                    o > 0.01
                      ? `0 ${Math.round(24 * o)}px 48px -8px rgba(0, 0, 0, ${(0.67 * o).toFixed(2)})`
                      : "none",
                  zIndex: Math.round(10 + o * 20),
                }}
                onClick={() => {
                  if (dragRef.current.moved) return;
                  if (i === selectedIdx) {
                    if (alb.browseId) {
                      router.push(`/album/${encodeURIComponent(alb.browseId)}`);
                    } else {
                      handlePlayAlbum(alb, false);
                    }
                  } else {
                    goTo(i);
                  }
                }}
              >
                {/* Tampilan Spine Vertikal */}
                {spineOp > 0.01 && (
                  <div
                    className="ypm-spine-face"
                    style={{ opacity: spineOp, width: `${alb.spine}px` }}
                  >
                    <div
                      className="ypm-spine-text"
                      style={{ height: `${box.height - alb.spine - 24}px` }}
                    >
                      <span className="ypm-spine-title">{alb.title}</span>
                      <span
                        className="ypm-spine-artist"
                        style={{ opacity: 0.7 }}
                      >
                        {alb.artist}
                      </span>
                    </div>

                    <div
                      className="ypm-spine-mini"
                      style={{
                        width: `${alb.spine - 12}px`,
                        height: `${alb.spine - 12}px`,
                      }}
                    >
                      {alb.thumb ? (
                        <img src={alb.thumb} alt="" loading="lazy" />
                      ) : (
                        <IconMusic className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </div>
                )}

                {/* Tampilan Kartu Tengah yang Tertarik Keluar */}
                {cardOp > 0.01 && (
                  <div
                    className="ypm-spine-card"
                    style={{ opacity: cardOp }}
                  >
                    <div className="ypm-spine-card-cover">
                      {alb.thumb ? (
                        <img
                          src={alb.thumb}
                          alt={alb.title}
                          loading="eager"
                        />
                      ) : (
                        <div className="ypm-spine-card-fb">
                          <IconMusic className="h-20 w-20 opacity-40" />
                        </div>
                      )}
                    </div>

                    <h2 className="ypm-spine-card-title">{alb.title}</h2>
                    <div className="ypm-spine-card-sub">
                      <span className="ypm-spine-card-artist">{alb.artist}</span>
                      {(alb.year || alb.tracks?.length > 0) && (
                        <span className="ypm-spine-card-year">
                          {alb.year || `${alb.tracks.length} lagu`}
                        </span>
                      )}
                    </div>

                    <div
                      className="ypm-spine-card-acts"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayAlbum(alb, false)}
                        aria-label={`Putar ${alb.title}`}
                        className="ypm-spine-play"
                      >
                        <IconPlay className="h-6 w-6" />
                      </button>

                      <div className="ypm-artist-more-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setMenuId(menuId === alb.id ? null : alb.id)
                          }
                          aria-label={`Opsi untuk ${alb.title}`}
                          className={`ypm-spine-more ${pal.darkText ? "is-on-light" : "is-on-dark"}`}
                        >
                          <IconEllipsis className="h-5 w-5" />
                        </button>

                        {isSelected && menuId === alb.id && (
                          <div
                            className="ypm-dropdown ypm-shelf-menu"
                            role="menu"
                          >
                            {alb.browseId && (
                              <button
                                type="button"
                                role="menuitem"
                                className="ypm-dropdown-item"
                                onClick={() =>
                                  router.push(
                                    `/album/${encodeURIComponent(alb.browseId)}`
                                  )
                                }
                              >
                                Buka halaman album
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              className="ypm-dropdown-item"
                              onClick={() => {
                                setMenuId(null);
                                handlePlayAlbum(alb, true);
                              }}
                            >
                              Putar acak
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="ypm-dropdown-item"
                              onClick={() => handleEnqueueAlbum(alb)}
                            >
                              Tambahkan ke antrean
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Fade kiri dan kanan seperti YesPlayMusic */}
          <div className="ypm-shelf-fade is-left" aria-hidden="true" />
          <div className="ypm-shelf-fade is-right" aria-hidden="true" />
        </div>
      </div>

      {/* Water-Column Timeline Scrubber di bawah rak */}
      <ShelfTimeline
        albums={albums}
        currentIndex={selectedIdx}
        sortMode={sortMode}
        onPick={goTo}
      />
    </div>
  );
}

// =========================================================================
// Tab Playlist (4-kolom kartu berwarna sampul seperti YesPlayMusic _PlaylistsBody)
// =========================================================================
function PlaylistsTab({ playlists, onOpenCreate }) {
  const { playTracks } = usePlayer();
  const cards = useMemo(
    () =>
      playlists.map((pl) => ({
        id: pl.id,
        title: pl.name,
        thumb: pl.tracks?.find((t) => t.thumbs || t.thumb)?.thumbs || pl.tracks?.find((t) => t.thumb)?.thumb || null,
        thumbs: (pl.tracks || []).map((t) => t.thumbs || t.thumb).filter(Boolean),
        tracks: pl.tracks || [],
        meta: `${pl.tracks?.length || 0} lagu`,
      })),
    [playlists]
  );
  const palettes = useCoverPalettes(cards);

  if (cards.length === 0) {
    return (
      <div className="ypm-lib-empty">
        <p className="ypm-lib-empty-title">Belum ada playlist lokal</p>
        <p className="ypm-lib-empty-sub">
          Buat playlist untuk mengumpulkan lagu favoritmu di perangkat ini.
        </p>
        <button
          type="button"
          onClick={onOpenCreate}
          className="ypm-pill ypm-pill-primary"
          style={{ marginTop: 18 }}
        >
          <IconPlus className="h-4 w-4" />
          Buat Playlist
        </button>
      </div>
    );
  }

  return (
    <div className="ypm-lib-pl-grid">
      {cards.map((c) => {
        const pal = palettes[c.id] || fallbackForKey(c.id || c.title);
        return (
          <Link
            key={c.id}
            href={`/playlist/${encodeURIComponent(c.id)}`}
            className="ypm-lib-pl-card"
            style={{ backgroundColor: pal.card, color: pal.onCard }}
          >
            <div className="ypm-lib-pl-art">
              {c.thumbs.length >= 4 ? (
                <div className="ypm-lib-pl-collage">
                  {c.thumbs.slice(0, 4).map((src, i) => (
                    <img key={i} src={src} alt="" loading="lazy" />
                  ))}
                </div>
              ) : c.thumb ? (
                <img src={c.thumb} alt={c.title} loading="lazy" />
              ) : (
                <div className="ypm-lib-pl-fb">
                  <IconMusic className="h-12 w-12 opacity-40" />
                </div>
              )}
            </div>

            <div className="ypm-lib-pl-foot">
              <div className="ypm-lib-pl-info">
                <p className="ypm-lib-pl-name">{c.title}</p>
                <p className="ypm-lib-pl-meta" style={{ opacity: 0.72 }}>
                  {c.meta}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Putar ${c.title}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (c.tracks.length > 0) playTracks(c.tracks, 0);
                  else toast("Playlist masih kosong");
                }}
                className="ypm-lib-pl-play"
                style={{
                  backgroundColor: pal.darkText ? "#0b0b0d" : "#ffffff",
                  color: pal.darkText ? "#ffffff" : "#0b0b0d",
                }}
              >
                <IconPlay className="h-5 w-5" />
              </button>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// =========================================================================
// Tab Artis (Spiral Bubble Cloud 1:1 YesPlayMusic _ArtistCloud)
// =========================================================================
function ArtistsBubbleTab({ artists }) {
  const { current } = usePlayer();
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(1100);

  useEffect(() => {
    const sync = () => {
      if (wrapRef.current) setWidth(Math.max(320, wrapRef.current.clientWidth));
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const cloud = useMemo(() => {
    if (!artists.length) return { placed: [], height: 0 };
    const minD = 96;
    const maxD = 180;
    const gap = 18;
    const labelH = 28;
    const top = Math.max(1, artists[0].weight);
    const cx = width / 2;
    const out = [];

    for (const a of artists) {
      const d = Math.round(
        Math.max(minD, Math.min(maxD, minD + (maxD - minD) * Math.sqrt(a.weight / top)))
      );
      const r = d / 2;
      let px = cx;
      let py = 0;

      for (let ang = 0, rad = 0; rad < 50000; ang += 8 / Math.max(rad, 8)) {
        rad = 4 * ang;
        px = cx + rad * Math.cos(ang);
        py = rad * 0.6 * Math.sin(ang);
        if (px - r < 0 || px + r > width) continue;
        const free = out.every((q) => {
          const need = r + q.d / 2 + gap;
          const dx = px - q.x;
          const dy = (Math.abs(py - q.y) * need) / (need + labelH);
          return dx * dx + dy * dy >= need * need;
        });
        if (free) break;
      }
      out.push({ a, x: px, y: py, d });
    }

    let lo = Infinity;
    let hi = 0;
    for (const q of out) {
      lo = Math.min(lo, q.y - q.d / 2);
      hi = Math.max(hi, q.y + q.d / 2 + labelH);
    }
    return {
      placed: out.map((q) => ({ ...q, y: q.y - lo })),
      height: Math.max(240, hi - lo + 24),
    };
  }, [artists, width]);

  if (artists.length === 0) {
    return (
      <div className="ypm-lib-empty">
        <p className="ypm-lib-empty-title">Belum ada artis di pustaka</p>
        <p className="ypm-lib-empty-sub">
          Putar atau sukai beberapa lagu untuk membangun peta artis favoritmu.
        </p>
      </div>
    );
  }

  const curArtist = current ? artistTextOf(current) : "";

  return (
    <div ref={wrapRef} className="ypm-bubble-wrap">
      <div className="ypm-bubble-stage" style={{ height: `${cloud.height}px` }}>
        {cloud.placed.map(({ a, x, y, d }) => {
          const selected = curArtist && curArtist.includes(a.name);
          const href = a.artistId
            ? `/artist/${encodeURIComponent(a.artistId)}`
            : `/search?q=${encodeURIComponent(a.name)}`;
          return (
            <Link
              key={a.key}
              href={href}
              className={`ypm-bubble ${selected ? "is-selected" : ""}`}
              style={{
                left: `${x - d / 2 - 36}px`,
                top: `${y - d / 2}px`,
                width: `${d + 72}px`,
              }}
            >
              <div
                className="ypm-bubble-circle"
                style={{ width: `${d}px`, height: `${d}px` }}
              >
                {a.thumb ? (
                  <img src={a.thumb} alt={a.name} loading="lazy" />
                ) : (
                  <div className="ypm-bubble-fb">
                    <IconMusic className="h-10 w-10 opacity-45" />
                  </div>
                )}
              </div>
              <span
                className="ypm-bubble-name"
                style={{ fontSize: d >= 140 ? "15px" : "13px" }}
              >
                {a.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// Tab Lagu (YesPlayMusic _SongsBody)
// =========================================================================
function SongsTab({ tracks }) {
  const { current, playing, playTracks, toggle, isLiked, toggleLike } =
    usePlayer();
  const [openMenu, setOpenMenu] = useState(null);
  const [playlistTarget, setPlaylistTarget] = useState(null);

  const totalSec = useMemo(
    () => tracks.reduce((sum, t) => sum + durationToSecs(t.duration), 0),
    [tracks]
  );

  if (tracks.length === 0) {
    return (
      <div className="ypm-lib-empty">
        <p className="ypm-lib-empty-title">Belum ada lagu disukai</p>
        <p className="ypm-lib-empty-sub">
          Tekan ikon hati di lagu mana pun untuk menyimpannya di pustakamu.
        </p>
        <Link
          href="/search"
          className="ypm-pill ypm-pill-ghost"
          style={{ marginTop: 18, textDecoration: "none" }}
        >
          Cari Musik
        </Link>
      </div>
    );
  }

  return (
    <div className="ypm-lib-songs">
      <div className="ypm-lib-songs-bar">
        <div className="ypm-lib-songs-acts">
          <button
            type="button"
            onClick={() => playTracks(tracks, 0)}
            className="ypm-pill ypm-pill-primary ypm-pill-sm"
          >
            <IconPlay className="h-4 w-4" />
            Putar
          </button>
          <button
            type="button"
            onClick={() => playTracks(shuffleTracks(tracks), 0)}
            className="ypm-pill ypm-pill-ghost ypm-pill-sm"
          >
            <IconShuffle className="h-4 w-4" />
            Acak
          </button>
        </div>
        <span className="ypm-lib-songs-total">
          {[
            `${tracks.length} lagu`,
            totalSec > 0 ? formatHours(totalSec) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div className="ypm-pl-rows">
        {tracks.map((t, i) => {
          const isActive = current?.videoId === t.videoId;
          const isPlayingNow = isActive && playing;
          const liked = isLiked?.(t.videoId);
          const thumb = t.thumbs || t.thumb || null;
          const albumLabel = albumNameOf(t);

          return (
            <div
              key={`${t.videoId}-${i}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isActive) toggle();
                else playTracks(tracks, i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (isActive) toggle();
                  else playTracks(tracks, i);
                }
              }}
              className={`ypm-pl-row ${isActive ? "is-active" : ""}`}
            >
              <span className="ypm-col-num" aria-hidden="true">
                {isPlayingNow ? (
                  <span className="ypm-eq">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  i + 1
                )}
              </span>

              <div className="ypm-col-title ypm-pl-title-cell">
                <div className="ypm-hot-thumb-wrap">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="ypm-hot-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <div className="ypm-hot-thumb ypm-hot-thumb-fb">
                      <IconMusic className="h-4 w-4" />
                    </div>
                  )}
                  <span className="ypm-hot-thumb-play" aria-hidden="true">
                    {isPlayingNow ? (
                      <IconPause className="h-3.5 w-3.5" />
                    ) : (
                      <IconPlay className="h-3.5 w-3.5" />
                    )}
                  </span>
                </div>
                <div className="ypm-hot-info">
                  <p className="ypm-hot-title">{t.title}</p>
                  <p className="ypm-hot-sub">{artistTextOf(t)}</p>
                </div>
              </div>

              <span className="ypm-col-album ypm-pl-album-text">
                {albumLabel}
              </span>

              <div
                className="ypm-pl-row-right"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => toggleLike?.(t)}
                  aria-label={
                    liked
                      ? `Hapus ${t.title} dari disukai`
                      : `Sukai ${t.title}`
                  }
                  aria-pressed={liked}
                  className={`ypm-hot-like ${liked ? "is-liked" : ""}`}
                >
                  <IconHeart className="h-4 w-4" filled={liked} />
                </button>

                <span className="ypm-pl-dur">{t.duration || ""}</span>

                <div className="ypm-hot-acts">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(
                        openMenu === `${t.videoId}-${i}`
                          ? null
                          : `${t.videoId}-${i}`
                      )
                    }
                    aria-label={`Opsi untuk ${t.title}`}
                    className="ypm-hot-more"
                  >
                    <IconEllipsis className="h-4 w-4" />
                  </button>

                  {openMenu === `${t.videoId}-${i}` && (
                    <TrackMenu
                      track={t}
                      onClose={() => setOpenMenu(null)}
                      onOpenPlaylistPicker={() => {
                        setOpenMenu(null);
                        setPlaylistTarget(t);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {playlistTarget && (
        <AddToPlaylistMenu
          track={playlistTarget}
          onClose={() => setPlaylistTarget(null)}
        />
      )}
    </div>
  );
}

// =========================================================================
// DesktopLibraryPage utama
// =========================================================================
export function DesktopLibraryPage({ initialTab = "albums", onOpenCoverFlow }) {
  const { liked = [], playlists = [], recent = [], createPlaylist } =
    usePlayer();
  const [tab, setTab] = useState(initialTab);
  const [shelfSort, setShelfSort] = useState(1); // 0 = Judul A-Z, 1 = Terbaru
  const [homeAlbums, setHomeAlbums] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlName, setNewPlName] = useState("");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Gabungkan seluruh track nyata di pustaka & riwayat putar lokal
  const allLibraryTracks = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = (t) => {
      if (!t || !t.videoId || seen.has(t.videoId)) return;
      seen.add(t.videoId);
      out.push(t);
    };
    liked.forEach(push);
    playlists.forEach((pl) => (pl.tracks || []).forEach(push));
    recent.forEach(push);
    return out;
  }, [liked, playlists, recent]);

  // Ekstrak koleksi album/single lokal untuk Record Shelf
  const localAlbums = useMemo(() => {
    const map = new Map();
    for (const t of allLibraryTracks) {
      const aName = albumNameOf(t);
      const artist = artistTextOf(t);
      const key =
        t.albumId ||
        (aName ? `al:${aName.toLowerCase()}::${artist.toLowerCase()}` : `sg:${t.videoId}`);
      if (!map.has(key)) {
        const title = aName || t.title;
        map.set(key, {
          id: key,
          browseId: t.albumId || null,
          title,
          artist,
          thumb: t.thumbs || t.thumb || null,
          year: t.year || "",
          spine: spineWidthFor(key + title),
          tracks: [t],
          order: map.size,
        });
      } else {
        const entry = map.get(key);
        entry.tracks.push(t);
        if (!entry.thumb && (t.thumbs || t.thumb)) {
          entry.thumb = t.thumbs || t.thumb;
        }
      }
    }
    return [...map.values()];
  }, [allLibraryTracks]);

  // Jika koleksi lokal masih sangat sedikit (< 10), lengkapi rak dengan album nyata dari /api/home
  useEffect(() => {
    if (localAlbums.length >= 10) return;
    let alive = true;
    fetch("/api/home")
      .then((r) => (r.ok ? r.json() : null))
      .then((shelves) => {
        if (!alive || !Array.isArray(shelves)) return;
        const seen = new Set();
        const extra = [];
        for (const sh of shelves) {
          for (const it of sh.items || []) {
            if (it.kind !== "album" || !it.browseId || seen.has(it.browseId)) {
              continue;
            }
            seen.add(it.browseId);
            extra.push({
              id: it.browseId,
              browseId: it.browseId,
              title: it.title,
              artist: it.artist || "Album",
              thumb: it.thumbs || null,
              year: it.year || "",
              spine: spineWidthFor(it.browseId + it.title),
              tracks: [],
              order: 1000 + extra.length,
            });
            if (extra.length >= 18) break;
          }
          if (extra.length >= 18) break;
        }
        setHomeAlbums(extra);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [localAlbums.length]);

  const shelfAlbums = useMemo(() => {
    const merged = [...localAlbums];
    if (merged.length < 10 && homeAlbums.length > 0) {
      const ids = new Set(merged.map((a) => a.browseId || a.id));
      for (const h of homeAlbums) {
        if (!ids.has(h.browseId)) merged.push(h);
      }
    }
    if (shelfSort === 0) {
      return [...merged].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", "id", {
          sensitivity: "base",
        })
      );
    }
    return [...merged].sort((a, b) => {
      const ya = Number(a.year) || 0;
      const yb = Number(b.year) || 0;
      if (ya && yb && ya !== yb) return yb - ya;
      return a.order - b.order;
    });
  }, [localAlbums, homeAlbums, shelfSort]);

  // Kumpulkan artis unik dari pustaka lokal dengan bobot jumlah lagu
  const libraryArtists = useMemo(() => {
    const map = new Map();
    for (const t of allLibraryTracks) {
      const name = artistTextOf(t).split(",")[0].trim();
      if (!name || name === "Artis tidak diketahui") continue;
      const key = t.artistId || name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          artistId: t.artistId || null,
          thumb: t.thumbs || t.thumb || null,
          weight: 1,
        });
      } else {
        const entry = map.get(key);
        entry.weight += 1;
        if (!entry.artistId && t.artistId) entry.artistId = t.artistId;
        if (!entry.thumb && (t.thumbs || t.thumb)) {
          entry.thumb = t.thumbs || t.thumb;
        }
      }
    }
    return [...map.values()].sort((a, b) => b.weight - a.weight);
  }, [allLibraryTracks]);

  const songCount = liked.length > 0 ? liked.length : recent.length;
  const visibleSongs = liked.length > 0 ? liked : recent;

  const handleCreatePlaylist = (e) => {
    e.preventDefault();
    const name = newPlName.trim();
    if (!name) return;
    createPlaylist?.(name);
    setNewPlName("");
    setCreateOpen(false);
    toast(`Playlist "${name}" dibuat`);
  };

  return (
    <div className="ypm-lib">
      {/* Header Pustaka: Tab dengan superscript count + Sort kanan + tombol Coverflow */}
      <header className="ypm-lib-head">
        <div className="ypm-lib-tabs" role="tablist" aria-label="Kategori pustaka">
          {[
            { id: "songs", label: "Lagu", count: songCount },
            { id: "albums", label: "Album", count: shelfAlbums.length },
            { id: "playlists", label: "Playlist", count: playlists.length },
            { id: "artists", label: "Artis", count: libraryArtists.length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`ypm-lib-tab ${tab === item.id ? "is-active" : ""}`}
            >
              <span>{item.label}</span>
              <sup className="ypm-lib-count">{formatCount(item.count)}</sup>
            </button>
          ))}
        </div>

        <div className="ypm-lib-head-right">
          {tab === "albums" && (
            <div className="ypm-lib-sorts" role="tablist" aria-label="Urutkan album">
              <button
                type="button"
                role="tab"
                aria-selected={shelfSort === 0}
                onClick={() => setShelfSort(0)}
                className={`ypm-lib-sort ${shelfSort === 0 ? "is-active" : ""}`}
              >
                Judul A-Z
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={shelfSort === 1}
                onClick={() => setShelfSort(1)}
                className={`ypm-lib-sort ${shelfSort === 1 ? "is-active" : ""}`}
              >
                Terbaru
              </button>
            </div>
          )}

          {tab === "playlists" && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="ypm-pill ypm-pill-ghost ypm-pill-sm"
            >
              <IconPlus className="h-4 w-4" />
              Buat Playlist
            </button>
          )}

          {onOpenCoverFlow && (
            <button
              type="button"
              onClick={onOpenCoverFlow}
              aria-label="Buka Cover Flow"
              title="Cover Flow"
              className="ypm-lib-cf-btn"
            >
              <IconDisc className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Isi Tab */}
      <div className="ypm-lib-body">
        {tab === "albums" &&
          (shelfAlbums.length > 0 ? (
            <RecordShelf albums={shelfAlbums} sortMode={shelfSort} />
          ) : (
            <div className="ypm-lib-empty">
              <p className="ypm-lib-empty-title">Rak album masih kosong</p>
              <p className="ypm-lib-empty-sub">
                Putar atau sukai lagu dari Beranda dan Pencarian untuk mengisi rak piringanmu.
              </p>
            </div>
          ))}

        {tab === "songs" && <SongsTab tracks={visibleSongs} />}

        {tab === "playlists" && (
          <PlaylistsTab
            playlists={playlists}
            onOpenCreate={() => setCreateOpen(true)}
          />
        )}

        {tab === "artists" && <ArtistsBubbleTab artists={libraryArtists} />}
      </div>

      {/* Modal Buat Playlist */}
      {createOpen && (
        <div
          className="ypm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Buat playlist baru"
          onClick={() => setCreateOpen(false)}
        >
          <div className="ypm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ypm-modal-head">
              <h3 className="ypm-modal-title">Buat playlist baru</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Tutup"
                className="ypm-modal-close"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePlaylist} className="ypm-modal-form">
              <input
                type="text"
                autoFocus
                value={newPlName}
                onChange={(e) => setNewPlName(e.target.value)}
                placeholder="Nama playlist..."
                className="ypm-modal-input"
              />
              <button
                type="submit"
                className="ypm-pill ypm-pill-primary ypm-pill-sm"
              >
                Buat
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
