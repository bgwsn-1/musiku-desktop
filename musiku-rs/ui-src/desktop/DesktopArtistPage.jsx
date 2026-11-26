// Halaman artis desktop bergaya YesPlayMusic:
// header avatar bulat 148px + sticky bar saat scroll,
// 2 kolom atas (Rilis Terbaru + Lagu Populer dengan toggle Semua/Ringkas),
// diskografi bertab (Album / Single & EP) dengan pager < >, dan Tentang.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconBack,
  IconEllipsis,
  IconForward,
  IconHeart,
  IconMusic,
  IconPause,
  IconPlay,
  IconShuffle,
} from "@/components/Icons";

const HOT_COLLAPSED_COUNT = 5;
const DISC_PAGE_SIZE = 6;

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function shuffleTracks(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fmtMeta(artist) {
  const parts = [];
  if (artist.monthlyListeners) parts.push(artist.monthlyListeners);
  if (artist.subscribers) parts.push(`${artist.subscribers} subscriber`);
  return parts.join(" · ");
}

export function DesktopArtistPage({ id }) {
  const router = useRouter();
  const { current, playing, playTracks, enqueue, toggle, isLiked, toggleLike } =
    usePlayer();
  const [artist, setArtist] = useState(null);
  const [err, setErr] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [showAllHot, setShowAllHot] = useState(false);
  const [discTab, setDiscTab] = useState("albums");
  const [discPage, setDiscPage] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTrackMenu, setOpenTrackMenu] = useState(null);
  const [playlistTarget, setPlaylistTarget] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setArtist(null);
    setErr(null);
    setShowAllHot(false);
    setDiscTab("albums");
    setDiscPage(0);
    setDescExpanded(false);
    setMenuOpen(false);
    setScrolled(false);
    fetch(`/api/artist/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!alive) return;
        setArtist(d);
        if ((!d.albums || d.albums.length === 0) && d.singles?.length > 0) {
          setDiscTab("singles");
        }
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  // Pantau scroll #main untuk menampilkan sticky header artis
  useEffect(() => {
    const mainEl = document.getElementById("main");
    if (!mainEl) return;
    const onScroll = () => {
      setScrolled(mainEl.scrollTop > 180);
    };
    onScroll();
    mainEl.addEventListener("scroll", onScroll, { passive: true });
    return () => mainEl.removeEventListener("scroll", onScroll);
  }, [id]);

  // Tutup dropdown menu saat klik luar atau Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const topSongs = useMemo(() => artist?.topSongs || [], [artist]);
  const albums = useMemo(() => artist?.albums || [], [artist]);
  const singles = useMemo(() => artist?.singles || [], [artist]);

  const latest = albums[0] || singles[0] || null;
  const latestKind = albums[0] ? "Album" : "Single & EP";

  const visibleHotSongs = showAllHot
    ? topSongs
    : topSongs.slice(0, HOT_COLLAPSED_COUNT);

  const activeDiscList = discTab === "albums" ? albums : singles;
  const totalDiscPages = Math.max(
    1,
    Math.ceil(activeDiscList.length / DISC_PAGE_SIZE)
  );
  const safeDiscPage = Math.min(discPage, totalDiscPages - 1);
  const visibleDisc = activeDiscList.slice(
    safeDiscPage * DISC_PAGE_SIZE,
    (safeDiscPage + 1) * DISC_PAGE_SIZE
  );

  const handlePlayAll = () => {
    if (topSongs.length > 0) playTracks(topSongs, 0);
    else toast("Belum ada lagu populer untuk diputar");
  };

  const handleShuffle = () => {
    if (topSongs.length > 0) playTracks(shuffleTracks(topSongs), 0);
    else toast("Belum ada lagu populer untuk diacak");
  };

  const handlePlayLatest = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!latest?.browseId) return;
    try {
      const res = await fetch(`/api/album/${encodeURIComponent(latest.browseId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        playTracks(data.tracks, 0);
        return;
      }
    } catch {
      // Fallback ke halaman album bila gagal fetch track
    }
    router.push(`/album/${encodeURIComponent(latest.browseId)}`);
  };

  if (err) {
    return (
      <div className="ypm-artist-empty">
        <p className="ypm-artist-empty-title">Gagal memuat halaman artis</p>
        <p className="ypm-artist-empty-sub">{err}</p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="ypm-artist" aria-busy="true">
        <div className="ypm-artist-head">
          <div className="ypm-skel ypm-skel-avatar" />
          <div className="ypm-artist-head-info">
            <div className="ypm-skel ypm-skel-eyebrow" />
            <div className="ypm-skel ypm-skel-title" />
            <div className="ypm-skel ypm-skel-meta" />
          </div>
        </div>
        <div className="ypm-artist-top">
          <div className="ypm-skel ypm-skel-latest" />
          <div className="ypm-skel-rows">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ypm-skel ypm-skel-row" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const avatar =
    artist.avatar ||
    (typeof artist.thumbs === "string"
      ? artist.thumbs
      : artist.thumbs?.[artist.thumbs.length - 1]?.url) ||
    artist.banner ||
    null;
  const latestThumb = latest?.thumbs || latest?.thumb || null;
  const metaLine = fmtMeta(artist);
  const desc = artist.desc || "";
  const isLongDesc = desc.length > 280;
  const shownDesc =
    isLongDesc && !descExpanded ? `${desc.slice(0, 280).trimEnd()}...` : desc;

  const stickyHost =
    typeof document !== "undefined"
      ? document.querySelector(".ds-center")
      : null;

  return (
    <div className="ypm-artist">
      {/* Sticky top header saat scroll melewati hero artis (di-portal ke .ds-center agar menempel rata di top: 0) */}
      {stickyHost &&
        createPortal(
          <div
            className={`ypm-artist-sticky ${scrolled ? "is-visible" : ""}`}
            aria-hidden={!scrolled}
          >
            <div className="ypm-artist-sticky-inner">
              <div className="ypm-artist-sticky-id">
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="ypm-artist-sticky-avatar"
                    loading="eager"
                  />
                ) : (
                  <div className="ypm-artist-sticky-avatar ypm-artist-avatar-fb">
                    <IconMusic className="h-4 w-4" />
                  </div>
                )}
                <span className="ypm-artist-sticky-name">{artist.name}</span>
              </div>
              <div className="ypm-artist-sticky-acts">
                <button
                  type="button"
                  onClick={handlePlayAll}
                  disabled={topSongs.length === 0}
                  className="ypm-pill ypm-pill-primary ypm-pill-sm"
                >
                  <IconPlay className="h-3.5 w-3.5" />
                  Putar
                </button>
                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={topSongs.length === 0}
                  className="ypm-pill ypm-pill-ghost ypm-pill-sm"
                >
                  <IconShuffle className="h-3.5 w-3.5" />
                  Acak
                </button>
              </div>
            </div>
          </div>,
          stickyHost
        )}

      {/* Header Artis: Avatar bulat 148px + Judul ArchivoWide + Tombol aksi */}
      <header className="ypm-artist-head">
        <div className="ypm-artist-avatar-wrap">
          {avatar ? (
            <img
              src={avatar}
              alt={artist.name}
              className="ypm-artist-avatar"
              loading="eager"
            />
          ) : (
            <div className="ypm-artist-avatar ypm-artist-avatar-fb">
              <IconMusic size={48} />
            </div>
          )}
        </div>

        <div className="ypm-artist-head-info">
          <span className="ypm-artist-eyebrow">Artis</span>
          <h1 className="ypm-artist-name">{artist.name}</h1>
          {metaLine && <p className="ypm-artist-meta">{metaLine}</p>}
        </div>

        <div className="ypm-artist-actions">
          <button
            type="button"
            onClick={handlePlayAll}
            disabled={topSongs.length === 0}
            className="ypm-pill ypm-pill-primary"
          >
            <IconPlay size={15} />
            Putar
          </button>
          <button
            type="button"
            onClick={handleShuffle}
            disabled={topSongs.length === 0}
            className="ypm-pill ypm-pill-ghost"
          >
            <IconShuffle size={15} />
            Acak
          </button>

          <div className="ypm-artist-more-wrap" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Opsi artis lainnya"
              aria-expanded={menuOpen}
              className="ypm-round-btn"
            >
              <IconEllipsis size={17} />
            </button>

            {menuOpen && (
              <div className="ypm-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="ypm-dropdown-item"
                  disabled={topSongs.length === 0}
                  onClick={() => {
                    topSongs.forEach((t) => enqueue(t));
                    toast(
                      `${topSongs.length} lagu populer ditambahkan ke antrean`
                    );
                    setMenuOpen(false);
                  }}
                >
                  Tambahkan lagu populer ke antrean
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="ypm-dropdown-item"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(window.location.href)
                      .catch(() => {});
                    toast("Tautan artis disalin");
                    setMenuOpen(false);
                  }}
                >
                  Salin tautan artis
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2-Kolom Atas: Rilis Terbaru (kiri 400px) + Lagu Populer (kanan flex) */}
      {(latest || topSongs.length > 0) && (
        <section className="ypm-artist-top">
          {latest && (
            <div className="ypm-artist-latest-col">
              <h2 className="ypm-sec-title">Rilis Terbaru</h2>
              <Link
                href={`/album/${encodeURIComponent(latest.browseId)}`}
                className="ypm-latest-card"
              >
                {latestThumb && (
                  <img
                    src={latestThumb}
                    alt=""
                    aria-hidden="true"
                    className="ypm-latest-bg"
                  />
                )}
                <div className="ypm-latest-scrim" aria-hidden="true" />

                <div className="ypm-latest-content">
                  <div className="ypm-latest-top">
                    {latestThumb ? (
                      <img
                        src={latestThumb}
                        alt={latest.title}
                        className="ypm-latest-cover"
                      />
                    ) : (
                      <div className="ypm-latest-cover ypm-latest-cover-fb">
                        <IconMusic className="h-9 w-9" />
                      </div>
                    )}
                    <div className="ypm-latest-meta">
                      <span className="ypm-latest-kind">{latestKind}</span>
                      {latest.year && (
                        <span className="ypm-latest-year">{latest.year}</span>
                      )}
                      <span className="ypm-latest-by">{artist.name}</span>
                    </div>
                  </div>

                  <div className="ypm-latest-bottom">
                    <h3 className="ypm-latest-title">{latest.title}</h3>
                    <button
                      type="button"
                      onClick={handlePlayLatest}
                      aria-label={`Putar ${latest.title}`}
                      className="ypm-latest-play"
                    >
                      <IconPlay size={20} />
                    </button>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {topSongs.length > 0 && (
            <div className="ypm-artist-hot-col">
              <div className="ypm-sec-head">
                <h2 className="ypm-sec-title">Lagu Populer</h2>
                {topSongs.length > HOT_COLLAPSED_COUNT && (
                  <button
                    type="button"
                    onClick={() => setShowAllHot((v) => !v)}
                    className="ypm-toggle-pill"
                  >
                    {showAllHot ? "Ringkas" : `Semua (${topSongs.length})`}
                  </button>
                )}
              </div>

              <div className="ypm-hot-list">
                {visibleHotSongs.map((t, idx) => {
                  const isActive = current?.videoId === t.videoId;
                  const isPlayingNow = isActive && playing;
                  const liked = isLiked(t.videoId);
                  const trackThumb = t.thumbs || t.thumb || null;
                  const trackSub =
                    (typeof t.album === "string" && t.album.trim()) ||
                    t.album?.name ||
                    (Array.isArray(t.artists)
                      ? t.artists.filter(Boolean).join(", ")
                      : t.artists || t.artist) ||
                    artist.name;
                  return (
                    <div
                      key={`${t.videoId}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (isActive) toggle();
                        else playTracks(topSongs, idx);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (isActive) toggle();
                          else playTracks(topSongs, idx);
                        }
                      }}
                      className={`ypm-hot-row ${isActive ? "is-active" : ""}`}
                    >
                      <span className="ypm-hot-num" aria-hidden="true">
                        {isPlayingNow ? (
                          <span className="ypm-eq">
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </span>

                      <div className="ypm-hot-thumb-wrap">
                        {trackThumb ? (
                          <img
                            src={trackThumb}
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
                        <p className="ypm-hot-sub">{trackSub}</p>
                      </div>

                      {t.duration && (
                        <span className="ypm-hot-dur">{t.duration}</span>
                      )}

                      <div
                        className="ypm-hot-acts"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => toggleLike(t)}
                          aria-label={
                            liked
                              ? `Hapus ${t.title} dari disukai`
                              : `Sukai ${t.title}`
                          }
                          aria-pressed={liked}
                          className={`ypm-hot-like ${liked ? "is-liked" : ""}`}
                        >
                          <IconHeart size={15} filled={liked} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenTrackMenu(
                              openTrackMenu === t.videoId ? null : t.videoId
                            )
                          }
                          aria-label={`Opsi untuk ${t.title}`}
                          aria-expanded={openTrackMenu === t.videoId}
                          className="ypm-hot-more"
                        >
                          <IconEllipsis size={15} />
                        </button>

                        {openTrackMenu === t.videoId && (
                          <TrackMenu
                            track={t}
                            onClose={() => setOpenTrackMenu(null)}
                            onOpenPlaylistPicker={() => {
                              setOpenTrackMenu(null);
                              setPlaylistTarget(t);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Diskografi Bertab: Album + Single & EP dengan pager < > */}
      {(albums.length > 0 || singles.length > 0) && (
        <section className="ypm-artist-disc">
          <div className="ypm-sec-head">
            <div className="ypm-tabs" role="tablist" aria-label="Diskografi">
              {albums.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={discTab === "albums"}
                  onClick={() => {
                    setDiscTab("albums");
                    setDiscPage(0);
                  }}
                  className={`ypm-tab ${discTab === "albums" ? "is-active" : ""}`}
                >
                  Album
                  <sup className="ypm-tab-count">{albums.length}</sup>
                </button>
              )}
              {singles.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={discTab === "singles"}
                  onClick={() => {
                    setDiscTab("singles");
                    setDiscPage(0);
                  }}
                  className={`ypm-tab ${discTab === "singles" ? "is-active" : ""}`}
                >
                  Single & EP
                  <sup className="ypm-tab-count">{singles.length}</sup>
                </button>
              )}
            </div>

            {totalDiscPages > 1 && (
              <div className="ypm-pager">
                <button
                  type="button"
                  onClick={() => setDiscPage((p) => Math.max(0, p - 1))}
                  disabled={safeDiscPage === 0}
                  aria-label="Halaman diskografi sebelumnya"
                  className="ypm-pager-btn"
                >
                  <IconBack size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDiscPage((p) => Math.min(totalDiscPages - 1, p + 1))
                  }
                  disabled={safeDiscPage >= totalDiscPages - 1}
                  aria-label="Halaman diskografi berikutnya"
                  className="ypm-pager-btn"
                >
                  <IconForward size={14} />
                </button>
              </div>
            )}
          </div>

          <div
            className="ypm-disc-grid"
            style={{ scrollBehavior: reduced() ? "auto" : "smooth" }}
          >
            {visibleDisc.map((al) => {
              const alThumb = al.thumbs || al.thumb || null;
              return (
                <Link
                  key={al.browseId}
                  href={`/album/${encodeURIComponent(al.browseId)}`}
                  className="ypm-disc-card"
                >
                  <div className="ypm-disc-art-wrap">
                    {alThumb ? (
                      <img
                        src={alThumb}
                        alt={al.title}
                        className="ypm-disc-art"
                        loading="lazy"
                      />
                    ) : (
                      <div className="ypm-disc-art ypm-disc-art-fb">
                        <IconMusic className="h-8 w-8" />
                      </div>
                    )}
                    <span className="ypm-disc-play" aria-hidden="true">
                      <IconPlay className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="ypm-disc-title">{al.title}</p>
                  <p className="ypm-disc-sub">
                    {[al.year, al.kind].filter(Boolean).join(" · ") ||
                      (discTab === "albums" ? "Album" : "Single")}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Tentang Artis */}
      {desc && (
        <section className="ypm-artist-about">
          <h2 className="ypm-sec-title">Tentang</h2>
          <div className="ypm-about-card">
            <p className="ypm-about-text">{shownDesc}</p>
            {isLongDesc && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="ypm-about-toggle"
              >
                {descExpanded ? "Tampilkan lebih sedikit" : "Baca selengkapnya"}
              </button>
            )}
          </div>
        </section>
      )}

      {playlistTarget && (
        <AddToPlaylistMenu
          track={playlistTarget}
          onClose={() => setPlaylistTarget(null)}
        />
      )}
    </div>
  );
}
