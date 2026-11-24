// Halaman artis desktop: hero full-bleed di puncak bingkai kanvas tengah,
// kartu Rilis Terbaru + grid Top Songs multi-kolom dengan pager < >,
// serta shelf Album, Single & EP, dan Tentang.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import { GridCard, Shelf } from "@/components/GridCard";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconBack,
  IconEllipsis,
  IconForward,
  IconMusic,
  IconPlay,
  IconShuffle,
} from "@/components/Icons";

const TOP_PAGE_SIZE = 6;

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

function descSnippet(d) {
  return d.length > 700 ? d.slice(0, 700).trimEnd() + "…" : d;
}

export function DesktopArtistPage({ id }) {
  const { current, playTracks, enqueue } = usePlayer();
  const [artist, setArtist] = useState(null);
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(0);
  const [videoPaused, setVideoPaused] = useState(() => reduced());
  const [videoFailed, setVideoFailed] = useState(false);
  const [menuState, setMenuState] = useState(null);
  const [addTrack, setAddTrack] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let live = true;
    const ac = new AbortController();
    setArtist(null);
    setMissing(false);
    setPage(0);
    setVideoFailed(false);
    fetch(`/api/artist/${encodeURIComponent(id)}`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((a) => {
        if (live) setArtist(a);
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
    const v = videoRef.current;
    if (!v) return;
    if (videoPaused || reduced()) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [videoPaused, artist?.topVideoId]);

  const latestRelease = useMemo(() => {
    if (!artist) return null;
    const pool = [...(artist.singles || []), ...(artist.albums || [])].filter(
      (x) => x && x.title,
    );
    if (!pool.length) return null;
    return pool.sort((a, b) => Number(b.year || 0) - Number(a.year || 0))[0];
  }, [artist]);

  if (missing) {
    return (
      <div className="px-7 py-24 text-center">
        <p className="text-[17px] font-semibold text-[#f3efec]">Artis tidak ditemukan</p>
        <p className="mt-1 text-[14px] text-[#a9a3a0]">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="animate-pulse space-y-4 p-7 pt-16">
        <div className="h-64 rounded-2xl bg-white/5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!artist.name) {
    return (
      <div className="px-7 py-24 text-center">
        <p className="text-[17px] font-semibold text-[#f3efec]">Artis tidak ditemukan</p>
        <p className="mt-1 text-[14px] text-[#a9a3a0]">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
      </div>
    );
  }

  const topSongs = Array.isArray(artist.topSongs) ? artist.topSongs : [];
  const totalPages = Math.max(1, Math.ceil(topSongs.length / TOP_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageSongs = topSongs.slice(
    safePage * TOP_PAGE_SIZE,
    safePage * TOP_PAGE_SIZE + TOP_PAGE_SIZE,
  );

  const heroImg = artist.banner || artist.thumbs || artist.avatar || null;
  const showHeroVideo = !!artist.topVideoId && !videoFailed && !reduced();
  const statLine = [
    artist.monthlyListeners ? String(artist.monthlyListeners) : null,
    artist.subscribers ? `${artist.subscribers} pengikut` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <section className="ds-artist-hero" aria-label={`Profil ${artist.name}`}>
        {showHeroVideo ? (
          <video
            ref={videoRef}
            src={`/api/stream/${encodeURIComponent(artist.topVideoId)}?video=1`}
            poster={heroImg || undefined}
            muted
            loop
            playsInline
            autoPlay={!videoPaused}
            onError={() => setVideoFailed(true)}
            className="ds-artist-bg"
          />
        ) : (
          heroImg && (
            <img
              src={heroImg}
              alt={`Foto ${artist.name}`}
              width="1600"
              height="720"
              fetchPriority="high"
              className="ds-artist-bg"
            />
          )
        )}

        <div className="ds-artist-scrim" aria-hidden="true" />

        <div className="ds-artist-hero-body">
          <div>
            {statLine && <p className="ds-artist-stats">{statLine}</p>}
            <h1 className="ds-artist-name">{artist.name}</h1>
            <div className="ds-artist-actions">
              <button
                type="button"
                className="ds-circle-btn"
                disabled={topSongs.length === 0}
                onClick={() => {
                  if (!topSongs.length) return;
                  enqueue(topSongs[0]);
                  toast(`${topSongs[0].title} ditambahkan ke antrean`);
                }}
                aria-label="Tambahkan lagu populer ke antrean"
                title="Tambahkan ke antrean"
              >
                <IconEllipsis className="h-5 w-5" />
              </button>

              <button
                type="button"
                className="ds-circle-btn ds-circle-play"
                disabled={topSongs.length === 0}
                onClick={() => topSongs.length && playTracks(topSongs, 0)}
                aria-label={`Putar lagu populer ${artist.name}`}
                title="Putar"
              >
                <IconPlay className="h-5 w-5" />
              </button>

              <button
                type="button"
                className="ds-circle-btn"
                disabled={topSongs.length === 0}
                onClick={() => topSongs.length && playTracks(shuffleTracks(topSongs), 0)}
                aria-label={`Acak lagu populer ${artist.name}`}
                title="Acak"
              >
                <IconShuffle className="h-[18px] w-[18px]" />
              </button>

              {showHeroVideo && (
                <button
                  type="button"
                  className="ds-circle-btn text-[11px] font-semibold"
                  onClick={() => setVideoPaused((v) => !v)}
                  aria-pressed={videoPaused}
                  aria-label={videoPaused ? "Putar video latar" : "Jeda video latar"}
                  title={videoPaused ? "Putar video latar" : "Jeda video latar"}
                >
                  {videoPaused ? "Play" : "Jeda"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {(latestRelease || topSongs.length > 0) && (
        <section className="ds-artist-showcase" aria-label="Rilis terbaru dan lagu populer">
          {latestRelease ? (
            <div>
              <h2 className="ds-top-title mb-2.5">Rilis Terbaru</h2>
              <Link
                href={latestRelease.browseId ? `/album/${latestRelease.browseId}` : `/artist/${id}`}
                className="ds-latest-card"
              >
                {latestRelease.thumbs ? (
                  <img
                    src={latestRelease.thumbs}
                    alt={`Sampul ${latestRelease.title}`}
                    width="96"
                    height="96"
                    className="ds-latest-art"
                  />
                ) : (
                  <span className="ds-latest-art flex items-center justify-center">
                    <IconMusic className="h-7 w-7 text-white/40" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {latestRelease.year && (
                    <span className="ds-latest-kicker">{latestRelease.year}</span>
                  )}
                  <p className="ds-latest-title">{latestRelease.title}</p>
                  <span className="ds-latest-meta">Buka rilis</span>
                </div>
              </Link>
            </div>
          ) : (
            <div />
          )}

          {topSongs.length > 0 && (
            <div className="min-w-0">
              <div className="ds-top-head">
                <h2 className="ds-top-title">Top Songs</h2>
                {totalPages > 1 && (
                  <div className="ds-top-pager">
                    <button
                      type="button"
                      className="ds-pager-btn"
                      disabled={safePage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      aria-label="Halaman lagu sebelumnya"
                    >
                      <IconBack className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="ds-pager-btn"
                      disabled={safePage >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      aria-label="Halaman lagu berikutnya"
                    >
                      <IconForward className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="ds-top-grid">
                {pageSongs.map((t, localIdx) => {
                  const realIdx = safePage * TOP_PAGE_SIZE + localIdx;
                  const active = current?.videoId === t.videoId;
                  const sub = [t.album, t.artist || artist.name].filter(Boolean).join(" · ");
                  return (
                    <div
                      key={`${t.videoId}-${realIdx}`}
                      className="ds-song-cell"
                      data-active={active ? "1" : undefined}
                    >
                      <button
                        type="button"
                        className="ds-song-hit"
                        onClick={() => playTracks(topSongs, realIdx)}
                        aria-current={active ? "true" : undefined}
                      >
                        {t.thumbs ? (
                          <img
                            src={t.thumbs}
                            alt=""
                            width="42"
                            height="42"
                            className="ds-song-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <span className="ds-song-thumb flex items-center justify-center">
                            <IconMusic className="h-4 w-4 text-white/40" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="ds-song-title">{t.title}</span>
                          {sub && <span className="ds-song-sub">{sub}</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ds-song-more"
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenuState({
                            track: t,
                            anchor: { x: r.right, y: r.bottom + 4, end: true },
                          });
                        }}
                        aria-haspopup="menu"
                        aria-label={`Opsi untuk ${t.title}`}
                      >
                        <IconEllipsis className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="ds-artist-sections">
        {artist.albums?.length > 0 && (
          <div className="mt-6">
            <Shelf title="Album">
              {artist.albums.map((a, i) => (
                <GridCard
                  key={`a${i}-${a.browseId}`}
                  i={i}
                  title={a.title}
                  subtitle={a.year ?? undefined}
                  href={a.browseId ? `/album/${a.browseId}` : undefined}
                  img={a.thumbs}
                />
              ))}
            </Shelf>
          </div>
        )}

        {artist.singles?.length > 0 && (
          <Shelf title="Single & EP">
            {artist.singles.map((a, i) => (
              <GridCard
                key={`s${i}-${a.browseId}`}
                i={i}
                title={a.title}
                subtitle={a.year ?? undefined}
                href={a.browseId ? `/album/${a.browseId}` : undefined}
                img={a.thumbs}
              />
            ))}
          </Shelf>
        )}

        {artist.desc && (
          <section className="mt-4 pb-6" aria-label="Tentang">
            <h2 className="ds-top-title mb-2">Tentang</h2>
            <p className="max-w-2xl whitespace-pre-line text-[14.5px] leading-relaxed text-[#a9a3a0]">
              {descSnippet(artist.desc)}
            </p>
          </section>
        )}
      </div>

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
