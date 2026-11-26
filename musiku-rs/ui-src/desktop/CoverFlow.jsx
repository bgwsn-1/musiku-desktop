// Cover Flow 3D desktop 1:1 mengikuti YesPlayMusic (lib/pages/coverflow.dart):
// - Latar atas warna dominan sampul aktif (CoverTone) yang memudar halus ke hitam pekat #000.
// - Tab terpusat di atas: Antrean, Lagu, Album, Playlist, Artis + tombol tutup kanan atas.
// - Geometri 3D iPod Cover Flow: sudut samping 75 derajat, kedalaman perspektif 2000px,
//   bayangan jarak, refleksi cermin 42% di bawah sampul, dan tombol Play putih 80px saat hover.
// - Judul ArchivoWide 30px + subjudul di bawah sampul aktif dengan kontrol drag, wheel, dan keyboard.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import {
  IconClose,
  IconMusic,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconUser,
} from "@/components/Icons";
import { extractCoverPalette, FALLBACK_PALETTE } from "./coverColor.js";

function artistOf(t) {
  if (Array.isArray(t.artists)) return t.artists.filter(Boolean).join(", ");
  return t.artists || t.artist || "Artis tidak diketahui";
}

function albumOf(t) {
  if (typeof t.album === "string" && t.album.trim()) return t.album.trim();
  if (t.album && typeof t.album === "object" && t.album.name) return t.album.name;
  return "";
}

function fmtCount(n) {
  return n < 1000 ? String(n) : n.toLocaleString("en-US");
}

export function CoverFlow({ onExit }) {
  const router = useRouter();
  const p = usePlayer();
  const {
    current,
    queue = [],
    index = 0,
    playing,
    liked = [],
    playlists = [],
    recent = [],
    toggle,
    next,
    prev,
    jumpTo,
    playTracks,
  } = p;

  const [tab, setTab] = useState(() => (queue.length > 0 ? "queue" : "albums"));
  const [selectedIdx, setSelectedIdx] = useState(() =>
    queue.length > 0 ? Math.max(0, Math.min(index, queue.length - 1)) : 0
  );
  const [renderPos, setRenderPos] = useState(selectedIdx);
  const [dir, setDir] = useState(0);
  const [tone, setTone] = useState(FALLBACK_PALETTE.deep);
  const [stageSize, setStageSize] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const posRef = useRef(selectedIdx);
  const velRef = useRef(0);
  const targetRef = useRef(selectedIdx);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startPos: 0,
    lastX: 0,
    lastT: 0,
    vel: 0,
    moved: false,
  });
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Kumpulkan semua lagu unik dari pustaka & riwayat
  const libraryTracks = useMemo(() => {
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

  // Bangun daftar item untuk tiap tab
  const collections = useMemo(() => {
    const queueItems = (queue.length > 0 ? queue : current ? [current] : []).map(
      (t, i) => ({
        key: `q-${t.videoId}-${i}`,
        title: t.title || "Lagu tanpa judul",
        sub: artistOf(t),
        cover: t.thumbs || t.thumb || "",
        round: false,
        isPlaying: current?.videoId === t.videoId,
        play: () => {
          if (current?.videoId === t.videoId) toggle();
          else if (queue.length > 0) jumpTo(i);
          else playTracks([t], 0);
        },
        open: () => {
          if (t.albumId) {
            onExit?.();
            router.push(`/album/${encodeURIComponent(t.albumId)}`);
          }
        },
      })
    );

    const songList = liked.length > 0 ? liked : recent;
    const songItems = songList.map((t, i) => ({
      key: `s-${t.videoId}-${i}`,
      title: t.title || "Lagu tanpa judul",
      sub: artistOf(t),
      cover: t.thumbs || t.thumb || "",
      round: false,
      isPlaying: current?.videoId === t.videoId,
      play: () => {
        if (current?.videoId === t.videoId) toggle();
        else playTracks(songList, i);
      },
      open: () => {
        if (t.albumId) {
          onExit?.();
          router.push(`/album/${encodeURIComponent(t.albumId)}`);
        }
      },
    }));

    const albumMap = new Map();
    for (const t of libraryTracks) {
      const aName = albumOf(t);
      const art = artistOf(t);
      const key =
        t.albumId ||
        (aName
          ? `al:${aName.toLowerCase()}::${art.toLowerCase()}`
          : `sg:${t.videoId}`);
      if (!albumMap.has(key)) {
        albumMap.set(key, {
          key,
          title: aName || t.title,
          sub: art,
          cover: t.thumbs || t.thumb || "",
          browseId: t.albumId || null,
          tracks: [t],
        });
      } else {
        const entry = albumMap.get(key);
        entry.tracks.push(t);
        if (!entry.cover && (t.thumbs || t.thumb)) {
          entry.cover = t.thumbs || t.thumb;
        }
      }
    }
    const albumItems = [...albumMap.values()].map((al) => ({
      key: `a-${al.key}`,
      title: al.title,
      sub: al.sub,
      cover: al.cover,
      round: false,
      isPlaying: al.tracks.some((t) => t.videoId === current?.videoId),
      play: () => playTracks(al.tracks, 0),
      open: () => {
        if (al.browseId) {
          onExit?.();
          router.push(`/album/${encodeURIComponent(al.browseId)}`);
        } else {
          playTracks(al.tracks, 0);
        }
      },
    }));

    const playlistItems = playlists.map((pl) => ({
      key: `p-${pl.id}`,
      title: pl.name,
      sub: `${pl.tracks?.length || 0} lagu`,
      cover:
        pl.tracks?.find((t) => t.thumbs || t.thumb)?.thumbs ||
        pl.tracks?.find((t) => t.thumb)?.thumb ||
        "",
      round: false,
      isPlaying: (pl.tracks || []).some((t) => t.videoId === current?.videoId),
      play: () => {
        if (pl.tracks?.length) playTracks(pl.tracks, 0);
        else toast("Playlist masih kosong");
      },
      open: () => {
        onExit?.();
        router.push(`/playlist/${encodeURIComponent(pl.id)}`);
      },
    }));

    const artistMap = new Map();
    for (const t of libraryTracks) {
      const name = artistOf(t).split(",")[0].trim();
      if (!name || name === "Artis tidak diketahui") continue;
      const key = t.artistId || name.toLowerCase();
      if (!artistMap.has(key)) {
        artistMap.set(key, {
          key,
          name,
          artistId: t.artistId || null,
          cover: t.thumbs || t.thumb || "",
          tracks: [t],
        });
      } else {
        const entry = artistMap.get(key);
        entry.tracks.push(t);
        if (!entry.artistId && t.artistId) entry.artistId = t.artistId;
        if (!entry.cover && (t.thumbs || t.thumb)) {
          entry.cover = t.thumbs || t.thumb;
        }
      }
    }
    const artistItems = [...artistMap.values()]
      .sort((a, b) => b.tracks.length - a.tracks.length)
      .map((ar) => ({
        key: `ar-${ar.key}`,
        title: ar.name,
        sub: `${ar.tracks.length} lagu`,
        cover: ar.cover,
        round: true,
        isPlaying: ar.tracks.some((t) => t.videoId === current?.videoId),
        play: () => playTracks(ar.tracks, 0),
        open: () => {
          onExit?.();
          if (ar.artistId) {
            router.push(`/artist/${encodeURIComponent(ar.artistId)}`);
          } else {
            router.push(`/search?q=${encodeURIComponent(ar.name)}`);
          }
        },
      }));

    return {
      queue: queueItems,
      songs: songItems,
      albums: albumItems,
      playlists: playlistItems,
      artists: artistItems,
    };
  }, [
    queue,
    current,
    liked,
    recent,
    playlists,
    libraryTracks,
    toggle,
    jumpTo,
    playTracks,
    onExit,
    router,
  ]);

  const items = collections[tab] || [];
  const n = items.length;
  const curItem = n > 0 ? items[Math.min(selectedIdx, n - 1)] : null;

  // Hitung metrik panggung 3D proporsional ukuran jendela (persis _StageMetrics)
  const metrics = useMemo(() => {
    const s = Math.max(
      0.45,
      Math.min(1.8, Math.min(stageSize.h / 900, stageSize.w / 780))
    );
    const size = Math.round(460 * s);
    return {
      scale: s,
      size,
      camera: 2000 * s,
      gap1: 410 * s,
      depth: 745 * s,
      step: 162 * s,
      pace: 120 * s,
    };
  }, [stageSize]);

  useEffect(() => {
    const onResize = () =>
      setStageSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Ekstrak warna dominan sampul aktif (CoverTone)
  useEffect(() => {
    let alive = true;
    if (!curItem?.cover) {
      setTone("#1c1c20");
      return;
    }
    extractCoverPalette(curItem.cover, curItem.key).then((pal) => {
      if (alive && pal?.deep) setTone(pal.deep);
    });
    return () => {
      alive = false;
    };
  }, [curItem?.cover, curItem?.key]);

  // Reset posisi saat ganti tab
  const selectTab = (nextTab) => {
    if (nextTab === tab) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const nextList = collections[nextTab] || [];
    const startIdx = Math.max(
      0,
      nextList.findIndex((it) => it.isPlaying)
    );
    setTab(nextTab);
    setDir(0);
    setSelectedIdx(startIdx);
    targetRef.current = startIdx;
    posRef.current = startIdx;
    velRef.current = 0;
    setRenderPos(startIdx);
  };

  const stepSpring = useCallback((now) => {
    if (!lastFrameRef.current) lastFrameRef.current = now;
    const dt = Math.min(0.032, Math.max(0.004, (now - lastFrameRef.current) / 1000));
    lastFrameRef.current = now;

    if (dragRef.current.active) {
      rafRef.current = 0;
      return;
    }

    const k = 210;
    const c = 27;
    const x = posRef.current - targetRef.current;
    const acc = -k * x - c * velRef.current;
    velRef.current += acc * dt;
    posRef.current += velRef.current * dt;

    if (Math.abs(x) < 0.0015 && Math.abs(velRef.current) < 0.01) {
      posRef.current = targetRef.current;
      velRef.current = 0;
      setRenderPos(targetRef.current);
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
      if (clamped !== targetRef.current) {
        setDir(clamped > targetRef.current ? 1 : -1);
      }
      targetRef.current = clamped;
      setSelectedIdx(clamped);
      lastFrameRef.current = 0;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(stepSpring);
    },
    [n, stepSpring]
  );

  // Bersihkan rAF hanya saat komponen unmount (bukan setiap curItem berubah)
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  // Sinkronkan posisi Cover Flow saat lagu aktif berubah (termasuk klik Next / Prev)
  useEffect(() => {
    if (dragRef.current.active || n === 0) return;
    if (tab === "queue") {
      const clamped = Math.max(0, Math.min(n - 1, index));
      if (clamped !== targetRef.current) {
        goTo(clamped);
      }
      return;
    }
    if (current?.videoId) {
      const matchIdx = items.findIndex((it) => it.isPlaying);
      if (matchIdx >= 0 && matchIdx !== targetRef.current) {
        goTo(matchIdx);
      }
    }
  }, [index, current?.videoId, tab, n, items, goTo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(targetRef.current - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(targetRef.current + 1);
      } else if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Enter" && curItem) {
        e.preventDefault();
        curItem.open?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onExit, goTo, toggle, curItem]);

  const onPointerDown = (e) => {
    if (e.target.closest("button, a") || n === 0) return;
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

    const nextPos = Math.max(
      -0.4,
      Math.min(n - 1 + 0.4, d.startPos - dx / metrics.pace)
    );
    posRef.current = nextPos;
    setRenderPos(nextPos);
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    const projected = posRef.current - (d.vel / metrics.pace) * 0.15;
    goTo(Math.round(projected));
  };

  const onWheel = (e) => {
    if (n === 0) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 6) {
      e.preventDefault();
      goTo(targetRef.current + (delta > 0 ? 1 : -1));
    }
  };

  // Hitung item yang terlihat di panggung & urutkan dari paling jauh ke paling depan
  const reach = Math.ceil(stageSize.w / 2 / metrics.pace) + 2;
  const lo = Math.max(0, Math.floor(renderPos) - reach);
  const hi = Math.min(n - 1, Math.ceil(renderPos) + reach);
  const visibleOrder = [];
  for (let i = lo; i <= hi; i++) visibleOrder.push(i);
  visibleOrder.sort((a, b) => Math.abs(b - renderPos) - Math.abs(a - renderPos));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cover Flow 3D"
      className="ypm-cf force-dark dialog-in"
      style={{ "--cf-tone": tone }}
    >
      {/* Latar gradasi CoverTone -> Hitam Pekat */}
      <div className="ypm-cf-bg" aria-hidden="true" />

      {/* Topbar: Tab terpusat + tombol tutup kanan atas */}
      <header className="ypm-cf-top">
        <div className="ypm-cf-pills" role="tablist" aria-label="Kategori Cover Flow">
          {[
            { id: "queue", label: "Antrean", count: collections.queue.length },
            { id: "songs", label: "Lagu", count: collections.songs.length },
            { id: "albums", label: "Album", count: collections.albums.length },
            { id: "playlists", label: "Playlist", count: collections.playlists.length },
            { id: "artists", label: "Artis", count: collections.artists.length },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => selectTab(t.id)}
              className={`ypm-cf-pill ${tab === t.id ? "is-active" : ""}`}
            >
              <span>{t.label}</span>
              <sup className="ypm-cf-pill-count">{fmtCount(t.count)}</sup>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onExit}
          aria-label="Tutup Cover Flow"
          title="Tutup (Esc)"
          className="ypm-cf-close"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </header>

      {/* Panggung 3D Cover Flow */}
      <div
        className="ypm-cf-stage"
        style={{ perspective: `${metrics.camera}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
      >
        {n === 0 ? (
          <div className="ypm-cf-empty">
            <p className="ypm-cf-empty-title">Belum ada item di kategori ini</p>
            <p className="ypm-cf-empty-sub">
              Putar atau sukai musik untuk menjelajahinya di Cover Flow.
            </p>
          </div>
        ) : (
          visibleOrder.map((i) => {
            const it = items[i];
            const d = i - renderPos;
            const ad = Math.abs(d);
            const isFront = ad < 0.5;
            const k = Math.min(ad, 1);
            const sign = d < 0 ? -1 : 1;
            const off =
              k * metrics.gap1 + (ad > 1 ? (ad - 1) * metrics.step : 0);
            const z = -k * metrics.depth;
            const rotY = -sign * 75 * k;
            const shade = Math.min(0.08 * ad, 0.48);
            const reflOp = Math.max(0.24 - 0.02 * ad, 0.12);
            const showPause = it.isPlaying && playing;

            return (
              <div
                key={it.key}
                className={`ypm-cf-card ${isFront ? "is-front" : ""} ${it.round ? "is-round" : ""}`}
                style={{
                  width: `${metrics.size}px`,
                  height: `${metrics.size}px`,
                  transform: `translate3d(${sign * off}px, 0, ${z}px) rotateY(${rotY}deg)`,
                  zIndex: Math.round(1000 - ad * 10),
                }}
                onClick={() => {
                  if (dragRef.current.moved) return;
                  if (!isFront) goTo(i);
                }}
                onDoubleClick={() => {
                  if (isFront) it.play?.();
                }}
              >
                <div className="ypm-cf-art-box">
                  {it.cover ? (
                    <img
                      src={it.cover}
                      alt={it.title}
                      className="ypm-cf-art-img"
                      draggable={false}
                    />
                  ) : (
                    <div className="ypm-cf-art-fb">
                      {it.round ? (
                        <IconUser className="h-20 w-20 opacity-20" />
                      ) : (
                        <IconMusic className="h-20 w-20 opacity-20" />
                      )}
                    </div>
                  )}

                  {shade > 0.005 && (
                    <div
                      className="ypm-cf-shade"
                      style={{ opacity: shade }}
                      aria-hidden="true"
                    />
                  )}

                  {isFront && (
                    <div className="ypm-cf-hover">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          it.play?.();
                        }}
                        aria-label={
                          showPause ? `Jeda ${it.title}` : `Putar ${it.title}`
                        }
                        className="ypm-cf-play-btn"
                      >
                        {showPause ? (
                          <IconPause className="h-9 w-9" />
                        ) : (
                          <IconPlay className="h-9 w-9" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Refleksi cermin 42% di bawah sampul */}
                <div
                  className="ypm-cf-refl"
                  style={{
                    height: `${Math.round(metrics.size * 0.42)}px`,
                    opacity: reflOp,
                  }}
                  aria-hidden="true"
                >
                  {it.cover ? (
                    <img
                      src={it.cover}
                      alt=""
                      className="ypm-cf-refl-img"
                      style={{
                        width: `${metrics.size}px`,
                        height: `${metrics.size}px`,
                      }}
                    />
                  ) : (
                    <div
                      className="ypm-cf-art-fb"
                      style={{
                        width: `${metrics.size}px`,
                        height: `${metrics.size}px`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Lapisan pudar hitam untuk ujung bawah refleksi */}
        <div className="ypm-cf-floor-fade" aria-hidden="true" />
      </div>

      {/* Info Judul ArchivoWide + Transport Kompak Bawah */}
      <footer className="ypm-cf-footer">
        {curItem && (
          <div
            key={`${tab}-${selectedIdx}`}
            className="ypm-cf-meta"
            data-dir={dir}
          >
            <button
              type="button"
              onClick={() => curItem.open?.()}
              className="ypm-cf-title-btn"
            >
              {curItem.title}
            </button>
            <p className="ypm-cf-sub">{curItem.sub}</p>
          </div>
        )}

        <div className="ypm-cf-bar">
          <button
            type="button"
            onClick={prev}
            aria-label="Lagu sebelumnya"
            className="ypm-cf-ctrl"
          >
            <IconPrev className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Jeda" : "Putar"}
            className="ypm-cf-ctrl is-main"
          >
            {playing ? (
              <IconPause className="h-6 w-6" />
            ) : (
              <IconPlay className="h-6 w-6" />
            )}
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Lagu berikutnya"
            className="ypm-cf-ctrl"
          >
            <IconNext className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
