// Halaman album desktop bergaya YesPlayMusic (split 2 kolom):
// Kiri: sampul squircle 360px sticky, jenis & tahun, judul ArchivoWide, artis, Putar/Acak/Simpan/Opsi.
// Kanan: jumlah lagu & durasi, pencarian & pengurutan, daftar trek bernomor, serta footer metadata rilis.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconClose,
  IconEllipsis,
  IconHeart,
  IconMusic,
  IconPause,
  IconPlay,
  IconPlus,
  IconSearch,
  IconShuffle,
} from "@/components/Icons";

function shuffleTracks(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function durationToSecs(d) {
  if (typeof d === "number" && Number.isFinite(d) && d > 0) return d;
  if (typeof d === "string") {
    const parts = d.split(":").map((x) => Number(x));
    if (parts.length === 2 && parts.every(Number.isFinite)) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 0;
}

function formatTrackDuration(d) {
  if (typeof d === "number" && Number.isFinite(d) && d > 0) {
    const total = Math.floor(d);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  if (typeof d === "string" && d.trim()) return d.trim();
  return "";
}

function normalizeTrack(t, album) {
  return {
    ...t,
    album: t.album || album.title,
    albumId: t.albumId || album.browseId,
    thumbs: t.thumbs || album.thumbs,
  };
}

export function DesktopAlbumPage({ id }) {
  const router = useRouter();
  const {
    current,
    playing,
    playlists,
    playTracks,
    enqueue,
    toggle,
    isLiked,
    toggleLike,
    createPlaylist,
    addToPlaylist,
  } = usePlayer();

  const [album, setAlbum] = useState(null);
  const [missing, setMissing] = useState(false);
  const [filter, setFilter] = useState("");
  const [sortMode, setSortMode] = useState("default");
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [newPlName, setNewPlName] = useState("");
  const [albumMenuOpen, setAlbumMenuOpen] = useState(false);
  const [menuState, setMenuState] = useState(null);
  const [addTrack, setAddTrack] = useState(null);
  const albumMenuWrapRef = useRef(null);

  useEffect(() => {
    let live = true;
    const ac = new AbortController();
    setAlbum(null);
    setMissing(false);
    setFilter("");
    setSortMode("default");
    setPlaylistModalOpen(false);
    setAlbumMenuOpen(false);
    fetch(`/api/album/${encodeURIComponent(id)}`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((a) => {
        if (live) {
          setAlbum(a);
          if (a?.title) setNewPlName(a.title);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError" && live) setMissing(true);
      });
    return () => {
      live = false;
      ac.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!albumMenuOpen) return;
    const onDown = (e) => {
      if (!albumMenuWrapRef.current?.contains(e.target)) {
        setAlbumMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAlbumMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [albumMenuOpen]);

  useEffect(() => {
    if (!playlistModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setPlaylistModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [playlistModalOpen]);

  const normalizedTracks = useMemo(() => {
    if (!album || !Array.isArray(album.tracks)) return [];
    return album.tracks.map((t) => normalizeTrack(t, album));
  }, [album]);

  const visibleTracks = useMemo(() => {
    const indexed = normalizedTracks.map((track, origIndex) => ({
      track,
      origIndex,
    }));
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? indexed.filter(({ track }) => {
          const title = (track.title || "").toLowerCase();
          const art = (
            track.artist ||
            (Array.isArray(track.artists)
              ? track.artists.join(", ")
              : track.artists) ||
            ""
          ).toLowerCase();
          return title.includes(q) || art.includes(q);
        })
      : indexed;

    if (sortMode === "title") {
      return [...filtered].sort((a, b) =>
        (a.track.title || "").localeCompare(b.track.title || "", "id", {
          sensitivity: "base",
        })
      );
    }
    if (sortMode === "duration") {
      return [...filtered].sort(
        (a, b) =>
          durationToSecs(b.track.duration) - durationToSecs(a.track.duration)
      );
    }
    return filtered;
  }, [normalizedTracks, filter, sortMode]);

  const artistName = useMemo(() => {
    if (!album?.artist) return "";
    return Array.isArray(album.artist)
      ? album.artist.filter(Boolean).join(", ")
      : album.artist;
  }, [album?.artist]);

  if (missing || (album && !album.title)) {
    return (
      <div className="ypm-artist-empty">
        <p className="ypm-artist-empty-title">Album tidak ditemukan</p>
        <p className="ypm-artist-empty-sub">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="ypm-pill ypm-pill-ghost ypm-pill-sm"
          style={{ marginTop: 18 }}
        >
          Kembali
        </button>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="ypm-split" aria-busy="true">
        <aside className="ypm-split-left">
          <div className="ypm-skel ypm-skel-plcard" />
        </aside>
        <section className="ypm-split-right">
          <div className="ypm-skel-rows">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="ypm-skel ypm-skel-row" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  const handleAddAlbumToPlaylist = (pl) => {
    if (!normalizedTracks.length) return;
    for (const t of normalizedTracks) {
      addToPlaylist?.(pl.id, t);
    }
    setPlaylistModalOpen(false);
    toast(`${normalizedTracks.length} lagu ditambahkan ke "${pl.name}"`);
  };

  const handleCreateAndAdd = (e) => {
    e.preventDefault();
    const name = newPlName.trim();
    if (!name || !normalizedTracks.length) return;
    const pid = createPlaylist?.(name);
    if (pid) {
      for (const t of normalizedTracks) {
        addToPlaylist?.(pid, t);
      }
      setPlaylistModalOpen(false);
      toast(`Playlist "${name}" dibuat dengan ${normalizedTracks.length} lagu`);
    }
  };

  const handleEnqueueAll = () => {
    if (!normalizedTracks.length) return;
    for (const t of normalizedTracks) {
      enqueue?.(t);
    }
    setAlbumMenuOpen(false);
    toast(`${normalizedTracks.length} lagu ditambahkan ke antrean`);
  };

  const handleLikeAll = () => {
    if (!normalizedTracks.length) return;
    let added = 0;
    for (const t of normalizedTracks) {
      if (!isLiked?.(t.videoId)) {
        toggleLike?.(t);
        added += 1;
      }
    }
    setAlbumMenuOpen(false);
    toast(
      added > 0
        ? `${added} lagu ditandai disukai`
        : "Semua lagu di album ini sudah disukai"
    );
  };

  const handleCopyLink = () => {
    setAlbumMenuOpen(false);
    if (typeof window === "undefined") return;
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => toast("Tautan album disalin"))
      .catch(() => toast("Gagal menyalin tautan"));
  };

  const metaEyebrow = [album.kind || "Album", album.year]
    .filter(Boolean)
    .join(" · ");
  const footerFacts = [
    album.year ? `Dirilis ${album.year}` : null,
    normalizedTracks.length ? `${normalizedTracks.length} lagu` : null,
    album.duration || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const washHost =
    typeof document !== "undefined"
      ? document.querySelector(".ds-shell")
      : null;

  return (
    <div className="ypm-album-page">
      {album.thumbs &&
        washHost &&
        createPortal(
          <div className="ypm-album-wash" aria-hidden="true">
            <img src={album.thumbs} alt="" className="ypm-album-wash-img" />
            <div className="ypm-album-wash-scrim" />
          </div>,
          washHost
        )}

      <div className="ypm-split ypm-album-split">
        {/* Kolom Kiri: Sampul 360px sticky + Info Album + Aksi */}
        <aside className="ypm-split-left">
          <div className="ypm-album-left-inner">
            <div className="ypm-album-cover-box">
              {album.thumbs ? (
                <img
                  src={album.thumbs}
                  alt={`Sampul ${album.title}`}
                  className="ypm-album-cover-img"
                  fetchPriority="high"
                />
              ) : (
                <div className="ypm-album-cover-img ypm-pl-cover-fb">
                  <IconMusic size={56} />
                </div>
              )}
            </div>

            <span className="ypm-album-eyebrow">{metaEyebrow}</span>
            <h1 className="ypm-album-heading">{album.title}</h1>

            {artistName && (
              <div className="ypm-album-artist">
                {album.thumbs && (
                  <img
                    src={album.thumbs}
                    alt=""
                    className="ypm-album-artist-thumb"
                  />
                )}
                {album.artistId ? (
                  <Link
                    href={`/artist/${encodeURIComponent(album.artistId)}`}
                    className="ypm-album-artist-a"
                  >
                    {artistName}
                  </Link>
                ) : (
                  <span className="ypm-album-artist-text">{artistName}</span>
                )}
              </div>
            )}

            <div className="ypm-album-acts">
              <button
                type="button"
                onClick={() =>
                  normalizedTracks.length > 0 && playTracks(normalizedTracks, 0)
                }
                disabled={normalizedTracks.length === 0}
                className="ypm-pill ypm-pill-primary"
              >
                <IconPlay size={15} />
                Putar
              </button>

              <button
                type="button"
                onClick={() =>
                  normalizedTracks.length > 0 &&
                  playTracks(shuffleTracks(normalizedTracks), 0)
                }
                disabled={normalizedTracks.length === 0}
                aria-label="Putar acak"
                title="Putar acak"
                className="ypm-round-btn"
              >
                <IconShuffle size={16} />
              </button>

              <button
                type="button"
                onClick={() => setPlaylistModalOpen(true)}
                disabled={normalizedTracks.length === 0}
                aria-label="Tambahkan album ke playlist"
                title="Tambahkan ke playlist"
                className="ypm-round-btn"
              >
                <IconPlus size={16} />
              </button>

              <div className="ypm-artist-more-wrap" ref={albumMenuWrapRef}>
                <button
                  type="button"
                  onClick={() => setAlbumMenuOpen((v) => !v)}
                  aria-label="Opsi album lainnya"
                  aria-expanded={albumMenuOpen}
                  className="ypm-round-btn"
                >
                  <IconEllipsis size={16} />
                </button>

                {albumMenuOpen && (
                  <div className="ypm-dropdown" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="ypm-dropdown-item"
                      onClick={handleEnqueueAll}
                    >
                      Tambahkan ke antrean
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ypm-dropdown-item"
                      onClick={handleLikeAll}
                    >
                      Tandai semua lagu disukai
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ypm-dropdown-item"
                      onClick={handleCopyLink}
                    >
                      Salin tautan album
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Kolom Kanan: Daftar Lagu + Filter + Sort + Footer */}
        <section className="ypm-split-right" aria-label="Daftar lagu album">
          <div className="ypm-album-right-head">
            <h2 className="ypm-sec-title" style={{ margin: 0 }}>
              Daftar Lagu
            </h2>
            <span className="ypm-album-right-meta">
              {[
                normalizedTracks.length ? `${normalizedTracks.length} lagu` : null,
                album.duration || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>

          <div className="ypm-split-toolbar">
            <div className="ypm-filter-box">
              <IconSearch size={15} className="ypm-filter-ico" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Cari lagu di album..."
                aria-label="Cari lagu di album"
                className="ypm-filter-input"
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  aria-label="Bersihkan pencarian"
                  className="ypm-filter-clear"
                >
                  <IconClose size={14} />
                </button>
              )}
            </div>

            <div className="ypm-sort-tabs" role="tablist" aria-label="Urutkan">
              {[
                { id: "default", label: "Asli" },
                { id: "title", label: "Judul A-Z" },
                { id: "duration", label: "Durasi" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={sortMode === tab.id}
                  onClick={() => setSortMode(tab.id)}
                  className={`ypm-sort-tab ${sortMode === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ypm-album-divider" />

          {visibleTracks.length === 0 ? (
            <div className="ypm-split-empty">
              <p className="ypm-split-empty-title">
                {filter
                  ? `Tidak ada lagu untuk "${filter}"`
                  : "Album ini belum memiliki lagu yang bisa dimuat"}
              </p>
            </div>
          ) : (
            <div className="ypm-pl-rows">
              {visibleTracks.map(({ track: t, origIndex }) => {
                const isActive = current?.videoId === t.videoId;
                const isPlayingNow = isActive && playing;
                const liked = isLiked?.(t.videoId);
                const subArtist = Array.isArray(t.artists)
                  ? t.artists.filter(Boolean).join(", ")
                  : t.artists || t.artist || artistName;

                return (
                  <div
                    key={`${t.videoId}-${origIndex}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isActive) toggle();
                      else playTracks(normalizedTracks, origIndex);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (isActive) toggle();
                        else playTracks(normalizedTracks, origIndex);
                      }
                    }}
                    className={`ypm-album-row ${isActive ? "is-active" : ""}`}
                  >
                    <span className="ypm-col-num" aria-hidden="true">
                      {isPlayingNow ? (
                        <span className="ypm-eq">
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        origIndex + 1
                      )}
                    </span>

                    <div className="ypm-hot-info">
                      <p className="ypm-hot-title">{t.title}</p>
                      {subArtist && subArtist !== artistName && (
                        <p className="ypm-hot-sub">{subArtist}</p>
                      )}
                    </div>

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
                        <IconHeart size={15} filled={liked} />
                      </button>

                      <span className="ypm-pl-dur">
                        {formatTrackDuration(t.duration)}
                      </span>

                      <div className="ypm-hot-acts">
                        <button
                          type="button"
                          onClick={() =>
                            setMenuState(
                              menuState === `${t.videoId}-${origIndex}`
                                ? null
                                : `${t.videoId}-${origIndex}`
                            )
                          }
                          aria-label={`Opsi untuk ${t.title}`}
                          className="ypm-hot-more"
                        >
                          <IconEllipsis size={15} />
                        </button>

                        {menuState === `${t.videoId}-${origIndex}` && (
                          <TrackMenu
                            track={t}
                            onClose={() => setMenuState(null)}
                            onOpenPlaylistPicker={() => {
                              setMenuState(null);
                              setAddTrack(t);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {footerFacts && <p className="ypm-album-footer">{footerFacts}</p>}
        </section>
      </div>

      {/* Modal Tambah Album ke Playlist */}
      {playlistModalOpen && (
        <div
          className="ypm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Tambahkan album ke playlist"
          onClick={() => setPlaylistModalOpen(false)}
        >
          <div className="ypm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ypm-modal-head">
              <h3 className="ypm-modal-title">Tambahkan album ke playlist</h3>
              <button
                type="button"
                onClick={() => setPlaylistModalOpen(false)}
                aria-label="Tutup"
                className="ypm-modal-close"
              >
                <IconClose size={16} />
              </button>
            </div>

            {playlists && playlists.length > 0 && (
              <div className="ypm-modal-list">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleAddAlbumToPlaylist(pl)}
                    className="ypm-modal-item"
                  >
                    <span>{pl.name}</span>
                    <span className="ypm-modal-count">
                      {pl.tracks?.length || 0} lagu
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateAndAdd} className="ypm-modal-form">
              <input
                type="text"
                value={newPlName}
                onChange={(e) => setNewPlName(e.target.value)}
                placeholder="Nama playlist baru..."
                className="ypm-modal-input"
              />
              <button type="submit" className="ypm-pill ypm-pill-primary ypm-pill-sm">
                Buat & Tambah
              </button>
            </form>
          </div>
        </div>
      )}

      {addTrack && (
        <AddToPlaylistMenu
          track={addTrack}
          onClose={() => setAddTrack(null)}
        />
      )}
    </div>
  );
}
