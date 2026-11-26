// Penyelarasan halaman Explore & Radio ke bahasa visual YesPlayMusic:
// - Judul ArchivoWide 44px, chip mood nyata (/api/moods),
//   rak artis/album dengan pager < >, dan kartu stasiun Radio squircle berwarna.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import {
  IconBack,
  IconForward,
  IconHeart,
  IconMusic,
  IconPause,
  IconPlay,
  IconRadio,
  IconUser,
} from "@/components/Icons";

function shuffleTracks(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((it) => {
    const k = keyFn(it);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function PagedRow({ title, items, pageSize = 6, renderItem }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visible = items.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <section className="ypm-exp-sec">
      <div className="ypm-sec-head">
        <h2 className="ypm-sec-title">{title}</h2>
        {totalPages > 1 && (
          <div className="ypm-pager">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label={`Halaman ${title} sebelumnya`}
              className="ypm-pager-btn"
            >
              <IconBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label={`Halaman ${title} berikutnya`}
              className="ypm-pager-btn"
            >
              <IconForward className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="ypm-disc-grid">{visible.map(renderItem)}</div>
    </section>
  );
}

// =========================================================================
// DesktopExplorePage (/explore)
// =========================================================================
export function DesktopExplorePage({ shelves }) {
  const router = useRouter();
  const { current, playing, playTracks, toggle, isLiked, toggleLike } =
    usePlayer();
  const [moods, setMoods] = useState([]);
  const [busyMood, setBusyMood] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/moods")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (!alive) return;
        const flat = Array.isArray(list)
          ? list.flatMap((g) => (Array.isArray(g.items) ? g.items : [g]))
          : [];
        setMoods(flat.filter((m) => m && m.params && m.title).slice(0, 14));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const openMood = async (m) => {
    if (busyMood) return;
    setBusyMood(m.params);
    try {
      const r = await fetch(`/api/mood/${encodeURIComponent(m.params)}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const pls = Array.isArray(d) ? d : d.playlists || d.items || [];
      const first = pls.find((x) => x.playlistId || x.browseId);
      if (first) {
        router.push(
          `/ytm-playlist/${encodeURIComponent(first.playlistId || first.browseId)}`
        );
      } else {
        router.push(`/search?q=${encodeURIComponent(m.title)}`);
      }
    } catch {
      router.push(`/search?q=${encodeURIComponent(m.title)}`);
    } finally {
      setBusyMood(null);
    }
  };

  if (shelves === null) {
    return (
      <div className="ypm-exp" aria-busy="true">
        <h1 className="ypm-set-heading">Explore</h1>
        <div className="ypm-skel-rows">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ypm-skel ypm-skel-row" />
          ))}
        </div>
      </div>
    );
  }

  const items = shelves.flatMap((s) => (s.items ? s.items : []));
  const artists = uniqueBy(
    items.filter((it) => it.kind === "artist"),
    (it) => it.browseId
  );
  const albums = uniqueBy(
    items.filter((it) => it.kind === "album"),
    (it) => it.browseId
  );
  const songTracks = uniqueBy(
    items.filter((it) => it.videoId),
    (it) => it.videoId
  )
    .slice(0, 12)
    .map(toTrack)
    .filter(Boolean);

  return (
    <div className="ypm-exp">
      <header className="ypm-exp-head">
        <h1 className="ypm-set-heading">Explore</h1>
        <p className="ypm-exp-sub">
          Temukan suasana, artis populer, album pilihan, dan lagu baru dari katalog Musiku.
        </p>
      </header>

      {/* Mood & Genre Chips */}
      {moods.length > 0 && (
        <section className="ypm-exp-sec">
          <h2 className="ypm-sec-title">Suasana & Genre</h2>
          <div className="ypm-mood-pills">
            {moods.map((m) => (
              <button
                key={m.params}
                type="button"
                disabled={busyMood === m.params}
                onClick={() => openMood(m)}
                className="ypm-mood-pill"
              >
                {m.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Artis Populer */}
      {artists.length > 0 && (
        <PagedRow
          title="Artis Populer"
          items={artists.slice(0, 24)}
          renderItem={(it, i) => (
            <Link
              key={`ar-${i}-${it.browseId}`}
              href={`/artist/${encodeURIComponent(it.browseId)}`}
              className="ypm-disc-card ypm-exp-artist-card"
            >
              <div className="ypm-disc-art-wrap ypm-exp-round">
                {it.thumbs ? (
                  <img
                    src={it.thumbs}
                    alt={it.title}
                    className="ypm-disc-art"
                    loading="lazy"
                  />
                ) : (
                  <div className="ypm-disc-art ypm-disc-art-fb">
                    <IconUser className="h-8 w-8 opacity-45" />
                  </div>
                )}
              </div>
              <p className="ypm-disc-title" style={{ textAlign: "center" }}>
                {it.title}
              </p>
              <p className="ypm-disc-sub" style={{ textAlign: "center" }}>
                Artis
              </p>
            </Link>
          )}
        />
      )}

      {/* Album Pilihan */}
      {albums.length > 0 && (
        <PagedRow
          title="Album Pilihan"
          items={albums.slice(0, 24)}
          renderItem={(it, i) => (
            <Link
              key={`al-${i}-${it.browseId}`}
              href={`/album/${encodeURIComponent(it.browseId)}`}
              className="ypm-disc-card"
            >
              <div className="ypm-disc-art-wrap">
                {it.thumbs ? (
                  <img
                    src={it.thumbs}
                    alt={it.title}
                    className="ypm-disc-art"
                    loading="lazy"
                  />
                ) : (
                  <div className="ypm-disc-art ypm-disc-art-fb">
                    <IconMusic className="h-8 w-8 opacity-45" />
                  </div>
                )}
                <span className="ypm-disc-play" aria-hidden="true">
                  <IconPlay className="h-4 w-4" />
                </span>
              </div>
              <p className="ypm-disc-title">{it.title}</p>
              <p className="ypm-disc-sub">{it.artist || "Album"}</p>
            </Link>
          )}
        />
      )}

      {/* Lagu untuk Mulai (2 kolom) */}
      {songTracks.length > 0 && (
        <section className="ypm-exp-sec">
          <div className="ypm-sec-head">
            <h2 className="ypm-sec-title">Lagu untuk Mulai</h2>
            <button
              type="button"
              onClick={() => playTracks(songTracks, 0)}
              className="ypm-toggle-pill"
            >
              Putar Semua
            </button>
          </div>
          <div className="ypm-search-2col">
            {songTracks.map((t, i) => {
              const isActive = current?.videoId === t.videoId;
              const isPlayingNow = isActive && playing;
              const likedNow = isLiked?.(t.videoId);
              return (
                <div
                  key={`${t.videoId}-${i}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isActive) toggle();
                    else playTracks(songTracks, i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isActive) toggle();
                      else playTracks(songTracks, i);
                    }
                  }}
                  className={`ypm-hot-row ${isActive ? "is-active" : ""}`}
                >
                  <div className="ypm-hot-thumb-wrap">
                    {t.thumbs ? (
                      <img
                        src={t.thumbs}
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
                    <p className="ypm-hot-sub">{t.artist || "Lagu"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike?.(t);
                    }}
                    aria-label={likedNow ? "Hapus dari disukai" : "Sukai"}
                    className={`ypm-hot-like ${likedNow ? "is-liked" : ""}`}
                  >
                    <IconHeart className="h-4 w-4" filled={likedNow} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// =========================================================================
// DesktopRadioPage (/radio)
// =========================================================================
const STATION_PALETTES = [
  { bg: "#7b1d2e", fg: "#ffffff" },
  { bg: "#6a3fb5", fg: "#ffffff" },
  { bg: "#2b5b7a", fg: "#ffffff" },
  { bg: "#c85a32", fg: "#ffffff" },
  { bg: "#d7b46a", fg: "#0b0b0d" },
  { bg: "#9ec9c5", fg: "#0b0b0d" },
];

export function DesktopRadioPage({ shelves }) {
  const { liked = [], recent = [], playTracks } = usePlayer();

  const catalogTracks = useMemo(() => {
    if (!shelves) return [];
    const seen = new Set();
    return shelves
      .flatMap((s) => (s.items ? s.items : []))
      .map(toTrack)
      .filter((t) => {
        if (!t || seen.has(t.videoId)) return false;
        seen.add(t.videoId);
        return true;
      });
  }, [shelves]);

  const stations = useMemo(() => {
    const out = [];
    const allPool = uniqueBy([...liked, ...recent, ...catalogTracks], (t) => t.videoId);
    if (allPool.length > 0) {
      out.push({
        id: "mix-daily",
        eyebrow: "Stasiun Utama",
        title: "Mix Hari Ini",
        sub: `${allPool.length} lagu acak dari favorit & katalog`,
        tracks: allPool,
        thumb: allPool[0]?.thumbs || null,
      });
    }
    if (liked.length > 0) {
      out.push({
        id: "mix-liked",
        eyebrow: "Favoritmu",
        title: "Radio Disukai",
        sub: `${liked.length} lagu favoritmu diputar acak`,
        tracks: liked,
        thumb: liked[0]?.thumbs || null,
      });
    }
    if (recent.length > 0) {
      out.push({
        id: "mix-recent",
        eyebrow: "Putar Ulang",
        title: "Putaran Terakhir",
        sub: `${recent.length} lagu yang baru kamu dengarkan`,
        tracks: recent,
        thumb: recent[0]?.thumbs || null,
      });
    }
    const likedIds = new Set(liked.map((t) => t.videoId));
    const discovery = catalogTracks.filter((t) => !likedIds.has(t.videoId));
    if (discovery.length > 0) {
      out.push({
        id: "mix-discover",
        eyebrow: "Eksplorasi",
        title: "Temuan Baru",
        sub: `${discovery.length} lagu di luar daftar disukaimu`,
        tracks: discovery,
        thumb: discovery[0]?.thumbs || null,
      });
    }
    return out;
  }, [liked, recent, catalogTracks]);

  if (shelves === null) {
    return (
      <div className="ypm-exp" aria-busy="true">
        <h1 className="ypm-set-heading">Radio</h1>
        <div className="ypm-skel-rows">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ypm-skel ypm-skel-row" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ypm-exp">
      <header className="ypm-exp-head">
        <h1 className="ypm-set-heading">Radio</h1>
        <p className="ypm-exp-sub">
          Stasiun mix acak yang diracik dari katalog dan pustaka lokalmu.
        </p>
      </header>

      {stations.length === 0 ? (
        <div className="ypm-lib-empty">
          <p className="ypm-lib-empty-title">Stasiun radio belum tersedia</p>
          <p className="ypm-lib-empty-sub">
            Periksa koneksi atau sukai beberapa lagu untuk membangun stasiun mix.
          </p>
        </div>
      ) : (
        <div className="ypm-radio-grid">
          {stations.map((st, idx) => {
            const pal = STATION_PALETTES[idx % STATION_PALETTES.length];
            const isLight = pal.fg === "#0b0b0d";
            return (
              <div
                key={st.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  playTracks(shuffleTracks(st.tracks), 0);
                  toast(`Memutar ${st.title}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    playTracks(shuffleTracks(st.tracks), 0);
                    toast(`Memutar ${st.title}`);
                  }
                }}
                className="ypm-radio-card"
                style={{ backgroundColor: pal.bg, color: pal.fg }}
              >
                {st.thumb && (
                  <img
                    src={st.thumb}
                    alt=""
                    aria-hidden="true"
                    className="ypm-radio-card-bg"
                  />
                )}
                <div className="ypm-radio-card-inner">
                  <div className="ypm-radio-card-top">
                    <span className="ypm-radio-eyebrow">
                      <IconRadio className="h-3.5 w-3.5" />
                      {st.eyebrow}
                    </span>
                  </div>

                  <div className="ypm-radio-card-bottom">
                    <div>
                      <h2 className="ypm-radio-title">{st.title}</h2>
                      <p className="ypm-radio-sub">{st.sub}</p>
                    </div>
                    <span
                      className="ypm-radio-play"
                      style={{
                        backgroundColor: isLight ? "#0b0b0d" : "#ffffff",
                        color: isLight ? "#ffffff" : "#0b0b0d",
                      }}
                      aria-hidden="true"
                    >
                      <IconPlay className="h-5 w-5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="ypm-set-hint">
        Stasiun menyusun antrean lagu langsung dari perangkat dan katalog Musiku, bukan siaran radio internet.
      </p>
    </div>
  );
}
