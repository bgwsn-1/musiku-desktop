// Halaman playlist desktop bergaya YesPlayMusic (split 2 kolom):
// Kiri: kartu squircle sticky dengan sampul (kolase 2x2 atau tunggal), judul ArchivoWide,
// pembuat/jumlah lagu, dan tombol Putar/Acak/Opsi.
// Kanan: filter pencarian, tab urutkan (Default / Judul A-Z / Album A-Z), dan daftar lagu.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/Dialog";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconClose,
  IconEllipsis,
  IconHeart,
  IconMusic,
  IconPause,
  IconPlay,
  IconSearch,
  IconShuffle,
  IconTrash,
} from "@/components/Icons";

function shuffleTracks(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function PlaylistCover({ tracks, singleThumb, title }) {
  if (singleThumb) {
    return (
      <img
        src={singleThumb}
        alt={`Sampul ${title}`}
        className="ypm-pl-cover"
        loading="eager"
      />
    );
  }
  const thumbs = tracks.map((t) => t.thumbs || t.thumb).filter(Boolean);
  if (thumbs.length >= 4) {
    return (
      <div className="ypm-pl-cover ypm-pl-collage">
        {thumbs.slice(0, 4).map((src, i) => (
          <img key={i} src={src} alt="" className="ypm-pl-collage-img" />
        ))}
      </div>
    );
  }
  if (thumbs.length > 0) {
    return (
      <img
        src={thumbs[0]}
        alt={`Sampul ${title}`}
        className="ypm-pl-cover"
        loading="eager"
      />
    );
  }
  return (
    <div className="ypm-pl-cover ypm-pl-cover-fb" aria-hidden="true">
      <IconMusic size={52} />
    </div>
  );
}

function SplitPlaylistBody({
  title,
  owner,
  meta,
  tracks,
  singleThumb = null,
  onRemoveTrack = null,
  onDeletePlaylist = null,
}) {
  const { current, playing, playTracks, enqueue, toggle, isLiked, toggleLike } =
    usePlayer();
  const [filter, setFilter] = useState("");
  const [sortMode, setSortMode] = useState("default");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTrackMenu, setOpenTrackMenu] = useState(null);
  const [playlistTarget, setPlaylistTarget] = useState(null);
  const menuRef = useRef(null);

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

  const rows = useMemo(() => {
    const indexed = tracks.map((track, origIndex) => ({ track, origIndex }));
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? indexed.filter(({ track }) => {
          const hay = [
            track.title,
            track.artist,
            Array.isArray(track.artists) ? track.artists.join(" ") : track.artists,
            typeof track.album === "string" ? track.album : track.album?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : indexed;

    if (sortMode === "title") {
      return [...filtered].sort((a, b) =>
        (a.track.title || "").localeCompare(b.track.title || "", "id", {
          sensitivity: "base",
        })
      );
    }
    if (sortMode === "album") {
      return [...filtered].sort((a, b) => {
        const alA =
          typeof a.track.album === "string"
            ? a.track.album
            : a.track.album?.name || "";
        const alB =
          typeof b.track.album === "string"
            ? b.track.album
            : b.track.album?.name || "";
        return alA.localeCompare(alB, "id", { sensitivity: "base" });
      });
    }
    return filtered;
  }, [tracks, filter, sortMode]);

  const bgThumb =
    singleThumb || tracks.find((t) => t.thumbs || t.thumb)?.thumbs || tracks.find((t) => t.thumb)?.thumb || null;

  const ownerInitial = owner ? owner.trim().charAt(0).toUpperCase() : "M";

  const handlePlayAll = () => {
    if (tracks.length > 0) playTracks(tracks, 0);
    else toast("Playlist belum memiliki lagu");
  };

  const handleShuffle = () => {
    if (tracks.length > 0) playTracks(shuffleTracks(tracks), 0);
    else toast("Playlist belum memiliki lagu");
  };

  return (
    <div className="ypm-split">
      {/* Kolom Kiri: Kartu Squircle Playlist Sticky */}
      <aside className="ypm-split-left">
        <div className="ypm-pl-card">
          {bgThumb && (
            <img
              src={bgThumb}
              alt=""
              aria-hidden="true"
              className="ypm-pl-card-bg"
            />
          )}
          <div className="ypm-pl-card-scrim" aria-hidden="true" />

          <div className="ypm-pl-card-inner">
            <PlaylistCover
              tracks={tracks}
              singleThumb={singleThumb}
              title={title}
            />

            <div className="ypm-pl-card-body">
              <span className="ypm-pl-eyebrow">Playlist</span>
              <h1 className="ypm-pl-title">{title}</h1>

              <div className="ypm-pl-owner-row">
                <span className="ypm-pl-owner-badge" aria-hidden="true">
                  {ownerInitial}
                </span>
                <span className="ypm-pl-owner-meta">{meta}</span>
              </div>

              <div className="ypm-pl-card-acts">
                <button
                  type="button"
                  onClick={handlePlayAll}
                  disabled={tracks.length === 0}
                  className="ypm-pill ypm-pill-primary"
                >
                  <IconPlay size={15} />
                  Putar
                </button>
                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={tracks.length === 0}
                  aria-label="Putar acak"
                  title="Putar acak"
                  className="ypm-round-btn"
                >
                  <IconShuffle size={16} />
                </button>

                {onDeletePlaylist ? (
                  <button
                    type="button"
                    onClick={onDeletePlaylist}
                    aria-label={`Hapus playlist ${title}`}
                    title="Hapus playlist"
                    className="ypm-round-btn ypm-round-danger"
                  >
                    <IconTrash size={16} />
                  </button>
                ) : (
                  <div className="ypm-artist-more-wrap" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="Opsi playlist lainnya"
                      aria-expanded={menuOpen}
                      className="ypm-round-btn"
                    >
                      <IconEllipsis size={16} />
                    </button>
                    {menuOpen && (
                      <div className="ypm-dropdown" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="ypm-dropdown-item"
                          disabled={tracks.length === 0}
                          onClick={() => {
                            tracks.forEach((t) => enqueue(t));
                            toast(`${tracks.length} lagu ditambahkan ke antrean`);
                            setMenuOpen(false);
                          }}
                        >
                          Tambahkan semua ke antrean
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="ypm-dropdown-item"
                          onClick={() => {
                            navigator.clipboard
                              ?.writeText(window.location.href)
                              .catch(() => {});
                            toast("Tautan playlist disalin");
                            setMenuOpen(false);
                          }}
                        >
                          Salin tautan playlist
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Kolom Kanan: Filter, Sort, dan Daftar Lagu */}
      <section className="ypm-split-right" aria-label="Daftar lagu">
        <div className="ypm-split-toolbar">
          <div className="ypm-filter-box">
            <IconSearch size={15} className="ypm-filter-ico" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Cari di playlist..."
              aria-label="Cari lagu di playlist"
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
              { id: "default", label: "Default" },
              { id: "title", label: "Judul A-Z" },
              { id: "album", label: "Album A-Z" },
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

        <div className="ypm-pl-colhead" aria-hidden="true">
          <span className="ypm-col-num">#</span>
          <span className="ypm-col-title">Judul</span>
          <span className="ypm-col-album">Album</span>
          <span className="ypm-col-dur">Durasi</span>
        </div>

        {rows.length === 0 ? (
          <div className="ypm-split-empty">
            <p className="ypm-split-empty-title">
              {filter ? `Tidak ada lagu untuk "${filter}"` : "Playlist masih kosong"}
            </p>
            {!filter && (
              <p className="ypm-split-empty-sub">
                Tambahkan lagu lewat menu titik tiga di baris lagu mana pun.
              </p>
            )}
          </div>
        ) : (
          <div className="ypm-pl-rows">
            {rows.map(({ track: t, origIndex }, i) => {
              const isActive = current?.videoId === t.videoId;
              const isPlayingNow = isActive && playing;
              const liked = isLiked(t.videoId);
              const thumb = t.thumbs || t.thumb || null;
              const artistLabel = Array.isArray(t.artists)
                ? t.artists.filter(Boolean).join(", ")
                : t.artists || t.artist || "";
              const albumLabel =
                typeof t.album === "string"
                  ? t.album
                  : t.album?.name || "";

              return (
                <div
                  key={`${t.videoId}-${origIndex}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isActive) toggle();
                    else playTracks(tracks, origIndex);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isActive) toggle();
                      else playTracks(tracks, origIndex);
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
                          <IconMusic size={16} />
                        </div>
                      )}
                      <span className="ypm-hot-thumb-play" aria-hidden="true">
                        {isPlayingNow ? (
                          <IconPause size={14} />
                        ) : (
                          <IconPlay size={14} />
                        )}
                      </span>
                    </div>
                    <div className="ypm-hot-info">
                      <p className="ypm-hot-title">{t.title}</p>
                      <p className="ypm-hot-sub">{artistLabel}</p>
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

                    <span className="ypm-pl-dur">{t.duration || ""}</span>

                    <div className="ypm-hot-acts">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenTrackMenu(
                            openTrackMenu === `${t.videoId}-${origIndex}`
                              ? null
                              : `${t.videoId}-${origIndex}`
                          )
                        }
                        aria-label={`Opsi untuk ${t.title}`}
                        className="ypm-hot-more"
                      >
                        <IconEllipsis size={15} />
                      </button>

                      {openTrackMenu === `${t.videoId}-${origIndex}` && (
                        <TrackMenu
                          track={t}
                          onClose={() => setOpenTrackMenu(null)}
                          onRemove={
                            onRemoveTrack
                              ? () => {
                                  onRemoveTrack(t.videoId);
                                  setOpenTrackMenu(null);
                                }
                              : undefined
                          }
                          onOpenPlaylistPicker={() => {
                            setOpenTrackMenu(null);
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
        )}
      </section>

      {playlistTarget && (
        <AddToPlaylistMenu
          track={playlistTarget}
          onClose={() => setPlaylistTarget(null)}
        />
      )}
    </div>
  );
}

export function DesktopPlaylistView({ id }) {
  const router = useRouter();
  const p = usePlayer();
  const pl = p.playlists.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(false);

  if (!pl) {
    return (
      <div className="ypm-artist-empty">
        <p className="ypm-artist-empty-title">Playlist tidak ada</p>
        <p className="ypm-artist-empty-sub">
          Mungkin sudah dihapus dari perangkat ini.
        </p>
      </div>
    );
  }

  return (
    <>
      <SplitPlaylistBody
        title={pl.name}
        owner="Lokal"
        meta={`${pl.tracks.length} lagu · tersimpan di perangkat ini`}
        tracks={pl.tracks}
        onRemoveTrack={(videoId) => p.removeFromPlaylist(pl.id, videoId)}
        onDeletePlaylist={() => setConfirm(true)}
      />

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Hapus "${pl.name}"?`}
        message="Playlist dihapus dari perangkat ini dan tidak bisa dikembalikan. Lagunya sendiri tidak ikut terhapus."
        confirmLabel="Hapus"
        onConfirm={() => {
          p.deletePlaylist(pl.id);
          router.push("/liked");
        }}
      />
    </>
  );
}

export function DesktopYtmPlaylistView({ id }) {
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setMissing(false);
    fetch(`/api/playlist/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        if (d) setData(d);
        else setMissing(true);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="ypm-artist-empty">
        <p className="ypm-artist-empty-title">Playlist tidak ditemukan</p>
        <p className="ypm-artist-empty-sub">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ypm-split" aria-busy="true">
        <aside className="ypm-split-left">
          <div className="ypm-skel ypm-skel-plcard" />
        </aside>
        <section className="ypm-split-right">
          <div className="ypm-skel-rows">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="ypm-skel ypm-skel-row" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  const count = data.trackCount ?? data.tracks.length;
  const metaParts = [data.owner, count ? `${count} lagu` : null].filter(Boolean);

  return (
    <SplitPlaylistBody
      title={data.title}
      owner={data.owner || "Musiku"}
      meta={metaParts.join(" · ")}
      tracks={data.tracks || []}
      singleThumb={data.thumbs || null}
    />
  );
}
