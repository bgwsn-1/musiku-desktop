// Halaman album desktop: hero full-bleed bernuansa sampul album,
// chip metadata, tombol aksi hangat, filter dan urutkan lagu, serta daftar trek bernomor.
import { useEffect, useMemo, useRef, useState } from "react";
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

function IconClock({ className = "h-3 w-3" }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconSortLines({ className = "h-3.5 w-3.5" }) {
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
      <path d="M4 7h12M4 12h8M4 17h4" />
      <path d="M17 10v9M14 16l3 3 3-3" />
    </svg>
  );
}

function IconCheckTiny({ className = "h-3 w-3" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const SORT_LABELS = {
  default: "Urutan Asli",
  title: "Judul A-Z",
  duration: "Durasi",
};

const NEXT_SORT = {
  default: "title",
  title: "duration",
  duration: "default",
};

export function DesktopAlbumPage({ id }) {
  const router = useRouter();
  const {
    current,
    playing,
    playlists,
    playTracks,
    enqueue,
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

  // Tutup dropdown menu album saat klik di luar atau tekan Escape.
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

  // Tutup modal tambah album ke playlist dengan Escape.
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
    const indexed = normalizedTracks.map((track, origIndex) => ({ track, origIndex }));
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? indexed.filter(({ track }) => {
          const title = (track.title || "").toLowerCase();
          const art = (track.artist || track.artists?.join(", ") || "").toLowerCase();
          return title.includes(q) || art.includes(q);
        })
      : indexed;

    if (sortMode === "title") {
      return [...filtered].sort((a, b) =>
        (a.track.title || "").localeCompare(b.track.title || "", "id", { sensitivity: "base" }),
      );
    }
    if (sortMode === "duration") {
      return [...filtered].sort(
        (a, b) => durationToSecs(b.track.duration) - durationToSecs(a.track.duration),
      );
    }
    return filtered;
  }, [normalizedTracks, filter, sortMode]);

  const artistName = useMemo(() => {
    if (!album?.artist) return "";
    return Array.isArray(album.artist) ? album.artist.filter(Boolean).join(", ") : album.artist;
  }, [album?.artist]);

  if (missing) {
    return (
      <div className="px-7 py-24 text-center">
        <p className="text-[17px] font-semibold text-[#f3efec]">Album tidak ditemukan</p>
        <p className="mt-1 text-[14px] text-[#a9a3a0]">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="ds-album-pill mt-5"
        >
          Kembali
        </button>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="ds-album-skeleton animate-pulse">
        <div className="ds-album-hero">
          <div className="ds-album-hero-inner">
            <div className="ds-album-cover-wrap bg-white/10" />
            <div className="ds-album-info">
              <div className="h-9 w-64 rounded-lg bg-white/10" />
              <div className="h-5 w-40 rounded-lg bg-white/10" />
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded-full bg-white/10" />
                <div className="h-6 w-20 rounded-full bg-white/10" />
                <div className="h-6 w-24 rounded-full bg-white/10" />
              </div>
              <div className="mt-2 flex gap-2">
                <div className="h-9 w-28 rounded-full bg-white/15" />
                <div className="h-9 w-28 rounded-full bg-white/15" />
              </div>
            </div>
          </div>
        </div>
        <div className="ds-album-body space-y-2 pt-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!album.title) {
    return (
      <div className="px-7 py-24 text-center">
        <p className="text-[17px] font-semibold text-[#f3efec]">Album tidak ditemukan</p>
        <p className="mt-1 text-[14px] text-[#a9a3a0]">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
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
        : "Semua lagu di album ini sudah disukai",
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

  const footerFacts = [
    album.year,
    normalizedTracks.length ? `${normalizedTracks.length} lagu` : null,
    album.duration,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <section className="ds-album-hero" aria-label={`Detail album ${album.title}`}>
        {album.thumbs && (
          <img
            src={album.thumbs}
            alt=""
            aria-hidden="true"
            className="ds-album-ambient"
          />
        )}
        <div className="ds-album-scrim" aria-hidden="true" />

        <div className="ds-album-hero-inner">
          <div className="ds-album-cover-wrap">
            {album.thumbs ? (
              <img
                src={album.thumbs}
                alt={`Sampul ${album.title}`}
                width="220"
                height="220"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <IconMusic className="h-12 w-12 text-white/35" />
              </span>
            )}
          </div>

          <div className="ds-album-info">
            <h1 className="ds-album-title">{album.title}</h1>

            {artistName && (
              <div className="ds-album-artist-row">
                {album.thumbs && (
                  <img
                    src={album.thumbs}
                    alt=""
                    width="22"
                    height="22"
                    className="ds-album-artist-avatar"
                  />
                )}
                {album.artistId ? (
                  <Link href={`/artist/${album.artistId}`} className="ds-album-artist-link">
                    {artistName}
                  </Link>
                ) : (
                  <span>{artistName}</span>
                )}
              </div>
            )}

            <div className="ds-album-chips">
              <span className="ds-album-chip">
                <IconDisc className="h-3.5 w-3.5" />
                <span>ALBUM</span>
              </span>
              {album.year && (
                <span className="ds-album-chip">
                  <IconClock className="h-3 w-3" />
                  <span>{album.year}</span>
                </span>
              )}
              {normalizedTracks.length > 0 && (
                <span className="ds-album-chip">
                  <IconMusic className="h-3 w-3" />
                  <span>{normalizedTracks.length} LAGU</span>
                </span>
              )}
              {album.duration && (
                <span className="ds-album-chip">
                  <span>{String(album.duration).toUpperCase()}</span>
                </span>
              )}
            </div>

            <div className="ds-album-actions">
              <div className="ds-album-actions-left">
                <button
                  type="button"
                  className="ds-album-pill"
                  disabled={normalizedTracks.length === 0}
                  onClick={() => normalizedTracks.length && playTracks(normalizedTracks, 0)}
                >
                  <IconPlay className="h-3.5 w-3.5" />
                  <span>Putar</span>
                </button>
                <button
                  type="button"
                  className="ds-album-pill"
                  disabled={normalizedTracks.length === 0}
                  onClick={() =>
                    normalizedTracks.length && playTracks(shuffleTracks(normalizedTracks), 0)
                  }
                >
                  <IconShuffle className="h-4 w-4" />
                  <span>Acak</span>
                </button>
              </div>

              <div className="ds-album-actions-right">
                <button
                  type="button"
                  className="ds-album-pill"
                  disabled={normalizedTracks.length === 0}
                  onClick={() => setPlaylistModalOpen(true)}
                >
                  <IconPlus className="h-4 w-4" />
                  <span>Tambah</span>
                </button>

                <div ref={albumMenuWrapRef} className="relative">
                  <button
                    type="button"
                    className="ds-album-pill ds-album-pill-icon"
                    onClick={() => setAlbumMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={albumMenuOpen}
                    aria-label="Opsi album lainnya"
                    title="Opsi lainnya"
                  >
                    <IconEllipsis className="h-5 w-5" />
                  </button>

                  {albumMenuOpen && (
                    <div className="ds-album-menu" role="menu" aria-label="Menu album">
                      <button
                        type="button"
                        role="menuitem"
                        className="ds-album-menu-item"
                        disabled={normalizedTracks.length === 0}
                        onClick={handleEnqueueAll}
                      >
                        Tambahkan semua ke antrean
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="ds-album-menu-item"
                        disabled={normalizedTracks.length === 0}
                        onClick={handleLikeAll}
                      >
                        Sukai semua lagu
                      </button>
                      {album.artistId && (
                        <button
                          type="button"
                          role="menuitem"
                          className="ds-album-menu-item"
                          onClick={() => {
                            setAlbumMenuOpen(false);
                            router.push(`/artist/${album.artistId}`);
                          }}
                        >
                          Buka halaman artis
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="ds-album-menu-item"
                        onClick={handleCopyLink}
                      >
                        Salin tautan album
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="ds-album-body">
        <div className="ds-album-toolbar">
          <div className="ds-album-filter">
            <IconSearch className="h-3.5 w-3.5 shrink-0" />
            <label htmlFor="ds-album-filter-input" className="sr-only">
              Cari lagu di album
            </label>
            <input
              id="ds-album-filter-input"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Cari lagu di album..."
              className="ds-album-filter-input"
            />
            {filter && (
              <button
                type="button"
                className="ds-album-filter-clear"
                onClick={() => setFilter("")}
                aria-label="Bersihkan pencarian"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            className="ds-album-sort-btn"
            onClick={() => setSortMode((s) => NEXT_SORT[s] || "default")}
            aria-label={`Ubah urutan lagu, saat ini ${SORT_LABELS[sortMode]}`}
            title="Ubah urutan daftar lagu"
          >
            <IconSortLines className="h-3.5 w-3.5" />
            <span>{SORT_LABELS[sortMode]}</span>
          </button>
        </div>

        {visibleTracks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[14px] font-medium text-[#d6ccc7]">
              {filter
                ? `Tidak ada lagu cocok dengan "${filter}".`
                : "Daftar lagu belum tersedia untuk album ini."}
            </p>
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="mt-3 cursor-pointer rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[12.5px] font-semibold text-[#f3efec] hover:bg-white/15"
              >
                Reset pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="ds-album-list" role="list" aria-label="Daftar lagu">
            {visibleTracks.map(({ track: t, origIndex }) => {
              const isCurrent = current?.videoId === t.videoId;
              const liked = isLiked?.(t.videoId) ?? false;
              const durText = formatTrackDuration(t.duration);
              const trackArtist = t.artist || t.artists?.filter(Boolean).join(", ") || "";
              const showTrackArtist =
                trackArtist && trackArtist.toLowerCase() !== artistName.toLowerCase();

              return (
                <div
                  key={`${t.videoId}-${origIndex}`}
                  role="listitem"
                  className="ds-album-row"
                  data-active={isCurrent ? "1" : undefined}
                  data-liked={liked ? "1" : undefined}
                >
                  <span className="ds-album-dot" aria-hidden="true" />

                  <button
                    type="button"
                    className="ds-album-row-hit"
                    onClick={() => playTracks(normalizedTracks, origIndex)}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={`Putar ${t.title}${showTrackArtist ? ` oleh ${trackArtist}` : ""}`}
                  >
                    <span className="ds-album-num" aria-hidden="true">
                      {isCurrent && playing ? (
                        <IconPause className="mx-auto h-3.5 w-3.5" />
                      ) : isCurrent ? (
                        <IconPlay className="mx-auto h-3.5 w-3.5" />
                      ) : (
                        origIndex + 1
                      )}
                    </span>

                    <span className="ds-album-row-main">
                      <span className="ds-album-row-title-line">
                        <span className="ds-album-row-title">{t.title || "Lagu tanpa judul"}</span>
                        {liked && (
                          <span className="ds-album-liked-mark" aria-hidden="true" title="Disukai">
                            <IconCheckTiny className="h-3 w-3" />
                          </span>
                        )}
                        {t.isExplicit && (
                          <span className="ds-album-explicit" aria-label="Eksplisit" title="Eksplisit">
                            E
                          </span>
                        )}
                      </span>
                      {showTrackArtist && (
                        <span className="ds-album-row-artist">{trackArtist}</span>
                      )}
                    </span>
                  </button>

                  <div className="ds-album-row-right">
                    <button
                      type="button"
                      className="ds-album-row-like"
                      data-liked={liked ? "1" : undefined}
                      onClick={() => toggleLike?.(t)}
                      aria-pressed={liked}
                      aria-label={liked ? `Hapus ${t.title} dari disukai` : `Sukai ${t.title}`}
                      title={liked ? "Hapus dari disukai" : "Sukai lagu"}
                    >
                      <IconHeart filled={liked} className="h-3.5 w-3.5" />
                    </button>

                    {durText && <span className="ds-album-row-dur">{durText}</span>}

                    <button
                      type="button"
                      className="ds-album-row-more"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setMenuState({
                          track: t,
                          anchor: { x: r.right, y: r.bottom + 4, end: true },
                        });
                      }}
                      aria-haspopup="menu"
                      aria-label={`Opsi untuk ${t.title}`}
                      title="Opsi lainnya"
                    >
                      <IconEllipsis className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {footerFacts && <p className="ds-album-foot">{footerFacts}</p>}
      </div>

      {playlistModalOpen && (
        <div
          className="ds-modal-wrap"
          role="dialog"
          aria-modal="true"
          aria-label="Tambah album ke playlist"
          onClick={() => setPlaylistModalOpen(false)}
        >
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold text-[#f3efec]">Tambah ke Playlist</h2>
              <button
                type="button"
                className="ds-sec-add"
                onClick={() => setPlaylistModalOpen(false)}
                aria-label="Tutup dialog playlist"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-[#b9b2ae]">
              Masukkan semua {normalizedTracks.length} lagu dari album ini ke playlist lokal.
            </p>

            {Array.isArray(playlists) && playlists.length > 0 && (
              <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleAddAlbumToPlaylist(pl)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[13.5px] font-semibold text-[#f3efec] transition-colors hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span className="truncate">{pl.name}</span>
                    <span className="ml-2 shrink-0 text-[11.5px] font-medium text-[#b5aeaa]">
                      {Array.isArray(pl.tracks) ? `${pl.tracks.length} lagu` : "0 lagu"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateAndAdd} className="mt-4 border-t border-white/10 pt-3">
              <label
                htmlFor="ds-album-new-pl"
                className="block text-[12px] font-semibold text-[#d6ccc7]"
              >
                Atau buat playlist baru
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="ds-album-new-pl"
                  type="text"
                  maxLength={80}
                  value={newPlName}
                  onChange={(e) => setNewPlName(e.target.value)}
                  placeholder="Nama playlist baru"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-[13.5px] text-[#f3efec] outline-none focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={!newPlName.trim()}
                  className="cursor-pointer rounded-xl bg-[#e3a28c] px-4 text-[13px] font-bold text-[#151010] hover:bg-[#edb39f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Buat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {menuState && (
        <TrackMenu
          track={menuState.track}
          anchor={menuState.anchor}
          onClose={() => setMenuState(null)}
          onAddToPlaylist={() => setAddTrack(menuState.track)}
        />
      )}
      {addTrack && <AddToPlaylistMenu track={addTrack} onClose={() => setAddTrack(null)} />}
    </div>
  );
}
