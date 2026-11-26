// Halaman Beranda desktop (gaya YesPlayMusic):
// - 2 kartu Hero besar (200px): Mix Pilihan dengan 3 sampul bertumpuk miring + Radio Musiku
// - Baris mode/mood ringkas (80px, 3 kolom) + daftar playlist mood terpilih
// - Rak horizontal dengan pager < > di kanan header untuk Terakhir Diputar, Rilis Baru, Lagu Baru, Artis Populer
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/lib/player";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconBack,
  IconForward,
  IconMusic,
  IconNext,
  IconPause,
  IconPlay,
} from "@/components/Icons";

const MOOD_LABELS = {
  chill: "Bersantai",
  relax: "Bersantai",
  "feel good": "Senang",
  happy: "Senang",
  party: "Pesta",
  energize: "Mengisi energi",
  energy: "Mengisi energi",
  sleep: "Tidur",
  sad: "Sedih",
  romantic: "Romantis",
  romance: "Romantis",
  love: "Cinta",
  focus: "Fokus",
  workout: "Olahraga",
  commute: "Perjalanan",
};

function moodLabel(name) {
  return MOOD_LABELS[(name || "").trim().toLowerCase()] ?? name;
}

function toTrack(it) {
  if (!it?.videoId) return null;
  return {
    videoId: it.videoId,
    title: it.title,
    artist: it.artist,
    artistId: it.artistId,
    thumbs: it.thumbs,
  };
}

function PagedShelf({ title, subtitle, items, perPage = 5, renderCard }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const visible = items.slice(safePage * perPage, safePage * perPage + perPage);

  if (!items.length) return null;

  return (
    <section className="ypm-section" aria-label={title}>
      <div className="ypm-sec-head">
        <div className="ypm-sec-titles">
          <h2 className="ypm-sec-title">{title}</h2>
          {subtitle && <span className="ypm-sec-sub">{subtitle}</span>}
        </div>
        {totalPages > 1 && (
          <div className="ypm-pager">
            <button
              type="button"
              className="ypm-pager-btn"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label={`Halaman sebelumnya untuk ${title}`}
            >
              <IconBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ypm-pager-btn"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label={`Halaman berikutnya untuk ${title}`}
            >
              <IconForward className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="ypm-card-grid">{visible.map(renderCard)}</div>
    </section>
  );
}

export function DesktopHomePage({ shelves }) {
  const { current, playing, recent, playTracks, toggle } = usePlayer();
  const [moods, setMoods] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const [moodPlaylists, setMoodPlaylists] = useState(null);
  const [moodLoading, setMoodLoading] = useState(false);
  const [radioIdx, setRadioIdx] = useState(0);
  const [menuState, setMenuState] = useState(null);
  const [addTrack, setAddTrack] = useState(null);

  useEffect(() => {
    let live = true;
    fetch("/api/moods")
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (live && Array.isArray(list)) setMoods(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedMood) {
      setMoodPlaylists(null);
      return;
    }
    let live = true;
    setMoodLoading(true);
    fetch(`/api/mood/${encodeURIComponent(selectedMood.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (live) setMoodPlaylists(Array.isArray(list) ? list : []);
      })
      .catch(() => live && setMoodPlaylists([]))
      .finally(() => live && setMoodLoading(false));
    return () => {
      live = false;
    };
  }, [selectedMood]);

  // Kumpulkan lagu untuk hero kanan (Radio Musiku) dan 3 sampul miring untuk hero kiri (Mix Pilihan).
  const radioTracks = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of shelves || []) {
      for (const it of s.items || []) {
        const t = toTrack(it);
        if (t && !seen.has(t.videoId)) {
          seen.add(t.videoId);
          out.push(t);
        }
      }
    }
    return out;
  }, [shelves]);

  const mixCovers = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const s of shelves || []) {
      for (const it of s.items || []) {
        if (it?.thumbs && !seen.has(it.thumbs)) {
          seen.add(it.thumbs);
          out.push(it.thumbs);
          if (out.length >= 3) return out;
        }
      }
    }
    return out;
  }, [shelves]);

  const leadAlbum = useMemo(() => {
    for (const s of shelves || []) {
      const al = (s.items || []).find((x) => x.kind === "album" && x.browseId);
      if (al) return al;
    }
    return null;
  }, [shelves]);

  const radioTrack = radioTracks.length
    ? radioTracks[radioIdx % radioTracks.length]
    : null;
  const radioIsPlaying =
    Boolean(radioTrack && current?.videoId === radioTrack.videoId && playing);

  const visibleMoods = moods.slice(0, 6);

  const renderHomeCard = (it, i) => {
    const isArtist = it.kind === "artist";
    const isAlbum = it.kind === "album";
    const track = toTrack(it);
    const href = isArtist
      ? `/artist/${encodeURIComponent(it.browseId)}`
      : isAlbum && it.browseId
        ? `/album/${encodeURIComponent(it.browseId)}`
        : null;
    const isActive = Boolean(track && current?.videoId === track.videoId);

    if (href) {
      return (
        <Link key={`${it.kind}-${it.browseId || i}`} href={href} className="ypm-card">
          <div className={`ypm-card-art ${isArtist ? "ypm-card-art-round" : ""}`}>
            {it.thumbs ? (
              <img src={it.thumbs} alt={it.title} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[#242428]">
                <IconMusic className="h-7 w-7 text-[#85858f]" />
              </span>
            )}
          </div>
          <p className={`ypm-card-title ${isArtist ? "text-center" : ""}`}>{it.title}</p>
          {it.artist && (
            <p className={`ypm-card-sub ${isArtist ? "text-center" : ""}`}>{it.artist}</p>
          )}
        </Link>
      );
    }

    return (
      <div
        key={`${track?.videoId || i}-${i}`}
        className="ypm-card"
        data-active={isActive ? "1" : undefined}
        onContextMenu={(e) => {
          if (!track) return;
          e.preventDefault();
          setMenuState({ track, anchor: { x: e.clientX, y: e.clientY, end: false } });
        }}
      >
        <button
          type="button"
          className="ypm-card-hit"
          onClick={() => {
            if (!track) return;
            const idx = radioTracks.findIndex((x) => x.videoId === track.videoId);
            playTracks(radioTracks.length ? radioTracks : [track], Math.max(0, idx));
          }}
        >
          <div className="ypm-card-art">
            {it.thumbs ? (
              <img src={it.thumbs} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[#242428]">
                <IconMusic className="h-7 w-7 text-[#85858f]" />
              </span>
            )}
            <span className="ypm-card-play" aria-hidden="true">
              {isActive && playing ? (
                <IconPause className="h-4 w-4" />
              ) : (
                <IconPlay className="h-4 w-4" />
              )}
            </span>
          </div>
          <p className="ypm-card-title">{it.title}</p>
          {it.artist && <p className="ypm-card-sub">{it.artist}</p>}
        </button>
      </div>
    );
  };

  return (
    <div className="ypm-home">
      {/* 2 Kartu Hero Besar (200px) */}
      <section className="ypm-hero-grid" aria-label="Sorotan beranda">
        {/* Kiri: Mix Pilihan dengan 3 sampul bertumpuk miring */}
        <div className="ypm-hero-card ypm-hero-covers">
          <div className="ypm-hero-text">
            <span className="ypm-hero-eyebrow">UNTUK KAMU</span>
            <h1 className="ypm-hero-title">Mix Pilihan</h1>
            <p className="ypm-hero-sub">
              {leadAlbum
                ? `${leadAlbum.title} · ${leadAlbum.artist || "Rilis terbaru"}`
                : "Kumpulan lagu pilihan dari katalog Musiku"}
            </p>
            <div className="ypm-hero-btns">
              <button
                type="button"
                className="ypm-play-pill"
                disabled={radioTracks.length === 0}
                onClick={() => radioTracks.length && playTracks(radioTracks, 0)}
              >
                <IconPlay className="h-4 w-4" />
                <span>Putar</span>
              </button>
              {leadAlbum && (
                <Link
                  href={`/album/${encodeURIComponent(leadAlbum.browseId)}`}
                  className="ypm-ghost-pill"
                >
                  Buka Rilis
                </Link>
              )}
            </div>
          </div>

          {mixCovers.length > 0 && (
            <div className="ypm-covers-stack" aria-hidden="true">
              {mixCovers.map((src, idx) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={`ypm-stack-img ypm-stack-img-${idx}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Kanan: Radio Musiku dengan sampul latar memudar ke kiri */}
        <div className="ypm-hero-card ypm-hero-station">
          {radioTrack?.thumbs && (
            <img
              src={radioTrack.thumbs}
              alt=""
              aria-hidden="true"
              className="ypm-station-bg"
            />
          )}
          <div className="ypm-station-scrim" aria-hidden="true" />

          <div className="ypm-hero-text">
            <span className="ypm-hero-eyebrow ypm-hero-eyebrow-accent">RADIO MUSIKU</span>
            <h2 className="ypm-hero-title">
              {radioTrack ? radioTrack.title : "Putar Instan"}
            </h2>
            <p className="ypm-hero-sub">
              {radioTrack?.artist || "Putar acak lagu populer dan rilisan terbaru"}
            </p>
            <div className="ypm-hero-btns">
              <button
                type="button"
                className="ypm-play-pill"
                disabled={!radioTrack}
                onClick={() => {
                  if (!radioTrack) return;
                  if (current?.videoId === radioTrack.videoId) {
                    toggle();
                  } else {
                    const idx = radioTracks.findIndex((x) => x.videoId === radioTrack.videoId);
                    playTracks(radioTracks, Math.max(0, idx));
                  }
                }}
              >
                {radioIsPlaying ? (
                  <IconPause className="h-4 w-4" />
                ) : (
                  <IconPlay className="h-4 w-4" />
                )}
                <span>{radioIsPlaying ? "Jeda" : "Putar"}</span>
              </button>

              <button
                type="button"
                className="ypm-round-btn"
                disabled={radioTracks.length < 2}
                onClick={() => setRadioIdx((n) => (n + 1) % radioTracks.length)}
                aria-label="Ganti lagu radio"
                title="Berikutnya"
              >
                <IconNext className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Baris Mood / Mode Ringkas (80px, 3 kolom) */}
      {visibleMoods.length > 0 && (
        <section className="ypm-section" aria-label="Suasana dan genre">
          <div className="ypm-sec-head">
            <div className="ypm-sec-titles">
              <h2 className="ypm-sec-title">Suasana &amp; Genre</h2>
              <span className="ypm-sec-sub">Pilih suasana untuk melihat playlist</span>
            </div>
          </div>
          <div className="ypm-modes-grid">
            {visibleMoods.map((mood) => {
              const active = selectedMood?.id === mood.id;
              return (
                <button
                  key={mood.id}
                  type="button"
                  className="ypm-mode-row"
                  data-active={active ? "1" : undefined}
                  aria-pressed={active}
                  onClick={() => setSelectedMood(active ? null : mood)}
                >
                  <span
                    className="ypm-mode-swatch"
                    style={mood.color ? { backgroundColor: mood.color } : undefined}
                    aria-hidden="true"
                  >
                    <IconMusic className="h-5 w-5" />
                  </span>
                  <span className="ypm-mode-text">
                    <span className="ypm-mode-title">{moodLabel(mood.title)}</span>
                    <span className="ypm-mode-sub">Playlist pilihan</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Playlist untuk Mood Terpilih */}
      {selectedMood && (
        <section className="ypm-section" aria-label={`Playlist ${moodLabel(selectedMood.title)}`}>
          {moodLoading ? (
            <div className="ypm-card-grid animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="aspect-square rounded-[16px] bg-white/5" />
              ))}
            </div>
          ) : moodPlaylists && moodPlaylists.length > 0 ? (
            <PagedShelf
              title={`Playlist ${moodLabel(selectedMood.title)}`}
              items={moodPlaylists}
              perPage={5}
              renderCard={(pl) => (
                <Link
                  key={pl.browseId}
                  href={`/ytm-playlist/${encodeURIComponent(pl.browseId)}`}
                  className="ypm-card"
                >
                  <div className="ypm-card-art">
                    {pl.thumbs ? (
                      <img src={pl.thumbs} alt={pl.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#242428]">
                        <IconMusic className="h-7 w-7 text-[#85858f]" />
                      </span>
                    )}
                  </div>
                  <p className="ypm-card-title">{pl.title}</p>
                  {pl.subtitle && <p className="ypm-card-sub">{pl.subtitle}</p>}
                </Link>
              )}
            />
          ) : (
            <p className="text-[13.5px] text-[#a1a1aa]">
              Belum ada playlist tersedia untuk suasana ini.
            </p>
          )}
        </section>
      )}

      {/* Terakhir Diputar */}
      {Array.isArray(recent) && recent.length > 0 && (
        <PagedShelf
          title="Terakhir Diputar"
          items={recent}
          perPage={5}
          renderCard={(t, i) => {
            const isActive = current?.videoId === t.videoId;
            return (
              <div
                key={`recent-${t.videoId}-${i}`}
                className="ypm-card"
                data-active={isActive ? "1" : undefined}
              >
                <button
                  type="button"
                  className="ypm-card-hit"
                  onClick={() => playTracks(recent, i)}
                >
                  <div className="ypm-card-art">
                    {t.thumbs ? (
                      <img src={t.thumbs} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#242428]">
                        <IconMusic className="h-7 w-7 text-[#85858f]" />
                      </span>
                    )}
                    <span className="ypm-card-play" aria-hidden="true">
                      {isActive && playing ? (
                        <IconPause className="h-4 w-4" />
                      ) : (
                        <IconPlay className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                  <p className="ypm-card-title">{t.title}</p>
                  {t.artist && <p className="ypm-card-sub">{t.artist}</p>}
                </button>
              </div>
            );
          }}
        />
      )}

      {/* Rak dari /api/home */}
      {(shelves || []).map((shelf) => (
        <PagedShelf
          key={shelf.title}
          title={shelf.title}
          items={shelf.items || []}
          perPage={5}
          renderCard={renderHomeCard}
        />
      ))}

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
