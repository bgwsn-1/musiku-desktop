// Halaman Pencarian desktop 1:1 mengikuti YesPlayMusic (search_idle.dart & search_results.dart):
// - Input pencarian squircle lebar penuh dengan sinkronisasi URL /search?q=...
// - Mode kosong (Idle): Pencarian Terakhir (tag kapsul), Baru Dibuka (2 kolom + hapus item),
//   dan Saran Populer (dari chart artis nyata /api/artists/charts).
// - Mode hasil: 5 tab (Semua, Lagu, Album, Artis, Video) dengan layout 2 kolom di tab Semua
//   (Kiri: Lagu & Album, Kanan: Artis & Video).
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { TrackMenu } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import {
  IconChevronRight,
  IconClose,
  IconEllipsis,
  IconHeart,
  IconMusic,
  IconPause,
  IconPlay,
  IconSearch,
  IconUser,
} from "@/components/Icons";

const LS_QUERIES = "musiku.search.queries";
const LS_HITS = "musiku.search.hits";

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, val) {
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Abaikan kuota penuh
  }
}

function artistLabelOf(t) {
  if (Array.isArray(t.artists)) return t.artists.filter(Boolean).join(", ");
  return t.artists || t.artist || "";
}

function albumLabelOf(t) {
  if (typeof t.album === "string") return t.album;
  return t.album?.name || "";
}

export function DesktopSearchPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const urlQ = (sp.get("q") || "").trim();

  const { current, playing, playTracks, toggle, isLiked, toggleLike } =
    usePlayer();

  const [input, setInput] = useState(urlQ);
  const [tab, setTab] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [queries, setQueries] = useState(() =>
    typeof window !== "undefined" ? readJson(LS_QUERIES, []) : []
  );
  const [hits, setHits] = useState(() =>
    typeof window !== "undefined" ? readJson(LS_HITS, []) : []
  );
  const [hotWords, setHotWords] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [playlistTarget, setPlaylistTarget] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  // Ambil daftar artis chart nyata untuk saran pencarian populer saat idle
  useEffect(() => {
    let alive = true;
    fetch("/api/artists/charts")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        const list = Array.isArray(j) ? j : Array.isArray(j.artists) ? j.artists : [];
        const words = list
          .map((a) => ({
            word: a.name || a.title || "",
            hint: a.subscribers || a.monthlyListeners || "Artis populer",
          }))
          .filter((x) => x.word)
          .slice(0, 10);
        setHotWords(words);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const rememberQuery = useCallback((term) => {
    const clean = term.trim();
    if (!clean) return;
    setQueries((prev) => {
      const next = [
        clean,
        ...prev.filter((w) => w.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 12);
      writeJson(LS_QUERIES, next);
      return next;
    });
  }, []);

  const clearQueries = useCallback(() => {
    setQueries([]);
    writeJson(LS_QUERIES, []);
  }, []);

  const rememberHit = useCallback((hit) => {
    if (!hit?.id) return;
    setHits((prev) => {
      const next = [
        hit,
        ...prev.filter((h) => !(h.kind === hit.kind && h.id === hit.id)),
      ].slice(0, 8);
      writeJson(LS_HITS, next);
      return next;
    });
  }, []);

  const forgetHit = useCallback((hit) => {
    setHits((prev) => {
      const next = prev.filter((h) => !(h.kind === hit.kind && h.id === hit.id));
      writeJson(LS_HITS, next);
      return next;
    });
  }, []);

  const runSearch = useCallback(
    (term) => {
      const clean = term.trim();
      if (!clean) {
        router.push("/search");
        return;
      }
      rememberQuery(clean);
      setInput(clean);
      router.push(`/search?q=${encodeURIComponent(clean)}`);
    },
    [rememberQuery, router]
  );

  // Fetch hasil pencarian paralel dari 4 filter server
  useEffect(() => {
    if (!urlQ) {
      setData(null);
      setErr(null);
      setLoading(false);
      return;
    }
    rememberQuery(urlQ);
    let alive = true;
    const ac = new AbortController();
    setLoading(true);
    setErr(null);
    setTab("all");

    const fetchFilter = (filter, limit) =>
      fetch(
        `/api/search?q=${encodeURIComponent(urlQ)}&filter=${filter}&limit=${limit}`,
        { signal: ac.signal }
      )
        .then((r) => (r.ok ? r.json() : []))
        .then((arr) => (Array.isArray(arr) ? arr : []))
        .catch(() => []);

    Promise.all([
      fetchFilter("songs", 24),
      fetchFilter("albums", 16),
      fetchFilter("artists", 12),
      fetchFilter("videos", 12),
    ])
      .then(([songs, albums, artists, videos]) => {
        if (!alive) return;
        setData({ songs, albums, artists, videos });
      })
      .catch((e) => {
        if (alive && e?.name !== "AbortError") setErr(String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [urlQ, rememberQuery]);

  const openHit = (h) => {
    rememberHit(h);
    if (h.track) {
      playTracks([h.track], 0);
      return;
    }
    if (h.kind === "album") router.push(`/album/${encodeURIComponent(h.id)}`);
    else if (h.kind === "artist") router.push(`/artist/${encodeURIComponent(h.id)}`);
  };

  const renderSongRow = (t, i, list) => {
    const isActive = current?.videoId === t.videoId;
    const isPlayingNow = isActive && playing;
    const liked = isLiked?.(t.videoId);
    const thumb = t.thumbs || t.thumb || null;
    const artist = artistLabelOf(t);
    const album = albumLabelOf(t);
    const key = `${t.videoId}-${i}`;

    const play = () => {
      if (isActive) {
        toggle();
        return;
      }
      playTracks(list, i);
      rememberHit({
        kind: "track",
        id: t.videoId,
        title: t.title,
        sub: artist,
        cover: thumb || "",
        track: t,
      });
    };

    return (
      <div
        key={key}
        role="button"
        tabIndex={0}
        onClick={play}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            play();
          }
        }}
        className={`ypm-sr-song ${isActive ? "is-active" : ""}`}
      >
        <div className="ypm-sr-thumb-wrap">
          {thumb ? (
            <img src={thumb} alt="" className="ypm-sr-thumb" loading="lazy" />
          ) : (
            <div className="ypm-sr-thumb ypm-sr-thumb-fb">
              <IconMusic className="h-4 w-4" />
            </div>
          )}
          <span className="ypm-sr-play" aria-hidden="true">
            {isPlayingNow ? (
              <IconPause className="h-4 w-4" />
            ) : (
              <IconPlay className="h-4 w-4" />
            )}
          </span>
        </div>

        <div className="ypm-sr-song-main">
          <p className="ypm-sr-song-title">{t.title}</p>
          <p className="ypm-sr-song-sub">{artist}</p>
        </div>

        <span className="ypm-sr-song-album">{album}</span>

        <div
          className="ypm-sr-song-right"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => toggleLike?.(t)}
            aria-label={
              liked ? `Hapus ${t.title} dari disukai` : `Sukai ${t.title}`
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
              onClick={() => setOpenMenu(openMenu === key ? null : key)}
              aria-label={`Opsi untuk ${t.title}`}
              className="ypm-hot-more"
            >
              <IconEllipsis className="h-4 w-4" />
            </button>
            {openMenu === key && (
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
  };

  const renderAlbums = (albums, limit) => (
    <div className="ypm-sr-albums">
      {albums.slice(0, limit).map((a, idx) => {
        const sub = Array.isArray(a.artist)
          ? a.artist.filter(Boolean).join(", ")
          : a.artist || "";
        return (
          <Link
            key={`${a.browseId || a.title}-${idx}`}
            href={a.browseId ? `/album/${encodeURIComponent(a.browseId)}` : "#"}
            onClick={() => {
              if (a.browseId) {
                rememberHit({
                  kind: "album",
                  id: a.browseId,
                  title: a.title,
                  sub,
                  cover: a.thumbs || "",
                });
              }
            }}
            className="ypm-sr-album-card"
          >
            <div className="ypm-sr-album-art">
              {a.thumbs ? (
                <img src={a.thumbs} alt={a.title} loading="lazy" />
              ) : (
                <div className="ypm-sr-album-fb">
                  <IconMusic className="h-7 w-7 opacity-40" />
                </div>
              )}
            </div>
            <p className="ypm-sr-album-title">{a.title}</p>
            <p className="ypm-sr-album-sub">
              {a.year || sub || "Album"}
            </p>
          </Link>
        );
      })}
    </div>
  );

  const renderArtists = (artists, limit) => (
    <div className="ypm-sr-artists">
      {artists.slice(0, limit).map((a, idx) => (
        <Link
          key={`${a.browseId || a.name}-${idx}`}
          href={a.browseId ? `/artist/${encodeURIComponent(a.browseId)}` : "#"}
          onClick={() => {
            if (a.browseId) {
              rememberHit({
                kind: "artist",
                id: a.browseId,
                title: a.name,
                sub: "Artis",
                cover: a.thumbs || "",
              });
            }
          }}
          className="ypm-sr-artist-row"
        >
          <div className="ypm-sr-artist-avatar">
            {a.thumbs ? (
              <img src={a.thumbs} alt={a.name} loading="lazy" />
            ) : (
              <div className="ypm-sr-artist-fb">
                <IconUser className="h-5 w-5 opacity-50" />
              </div>
            )}
          </div>
          <div className="ypm-sr-artist-info">
            <p className="ypm-sr-artist-name">{a.name}</p>
            {a.subscribers && (
              <p className="ypm-sr-artist-sub">{a.subscribers} subscriber</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );

  const renderVideos = (videos, limit) => (
    <div className="ypm-sr-videos">
      {videos.slice(0, limit).map((v, idx) => {
        const thumb = v.thumbs || v.thumb || null;
        const artist = artistLabelOf(v);
        const isActive = current?.videoId === v.videoId;
        return (
          <button
            key={`${v.videoId}-${idx}`}
            type="button"
            onClick={() => {
              playTracks(videos, idx);
              rememberHit({
                kind: "track",
                id: v.videoId,
                title: v.title,
                sub: artist,
                cover: thumb || "",
                track: v,
              });
            }}
            className={`ypm-sr-video-row ${isActive ? "is-active" : ""}`}
          >
            <div className="ypm-sr-video-thumb">
              {thumb ? (
                <img src={thumb} alt="" loading="lazy" />
              ) : (
                <IconMusic className="h-4 w-4 opacity-45" />
              )}
            </div>
            <div className="ypm-sr-video-info">
              <p className="ypm-sr-video-title">{v.title}</p>
              <p className="ypm-sr-video-sub">
                {[artist, v.duration].filter(Boolean).join(" · ")}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  const hasHistory = queries.length > 0 || hits.length > 0;
  const totalCount = data
    ? data.songs.length +
      data.albums.length +
      data.artists.length +
      data.videos.length
    : 0;

  return (
    <div className="ypm-search">
      {/* Kolom Pencarian YesPlayMusic */}
      <form
        className="ypm-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(input);
        }}
      >
        <div className="ypm-search-box">
          <IconSearch className="ypm-search-ico h-5 w-5" />
          <input
            ref={inputRef}
            type="search"
            value={input}
            autoFocus={!urlQ}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Cari lagu, album, artis, atau video..."
            aria-label="Cari musik"
            className="ypm-search-input"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                if (urlQ) router.push("/search");
                inputRef.current?.focus();
              }}
              aria-label="Hapus kata kunci"
              className="ypm-search-clear"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {/* Mode Idle (belum ada query) */}
      {!urlQ && (
        <div className="ypm-search-idle">
          {queries.length > 0 && (
            <section className="ypm-search-sec">
              <div className="ypm-search-sec-head">
                <h2 className="ypm-search-sec-title">Pencarian Terakhir</h2>
                <button
                  type="button"
                  onClick={clearQueries}
                  className="ypm-search-sec-act"
                >
                  Bersihkan
                </button>
              </div>
              <div className="ypm-search-tags">
                {queries.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => runSearch(w)}
                    className="ypm-search-tag"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </section>
          )}

          {hits.length > 0 && (
            <section className="ypm-search-sec">
              <div className="ypm-search-sec-head">
                <h2 className="ypm-search-sec-title">Baru Dibuka</h2>
              </div>
              <div className="ypm-search-2col">
                {hits.map((h) => {
                  const round = h.kind === "artist";
                  const badge =
                    h.kind === "album"
                      ? "Album"
                      : h.kind === "artist"
                        ? "Artis"
                        : "Lagu";
                  return (
                    <div
                      key={`${h.kind}-${h.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openHit(h)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openHit(h);
                        }
                      }}
                      className="ypm-hit-row"
                    >
                      <div
                        className={`ypm-hit-art ${round ? "is-round" : ""}`}
                      >
                        {h.cover ? (
                          <img src={h.cover} alt="" loading="lazy" />
                        ) : round ? (
                          <IconUser className="h-4 w-4 opacity-50" />
                        ) : (
                          <IconMusic className="h-4 w-4 opacity-50" />
                        )}
                      </div>
                      <div className="ypm-hit-info">
                        <p className="ypm-hit-title">{h.title}</p>
                        {h.sub && <p className="ypm-hit-sub">{h.sub}</p>}
                      </div>
                      <span className="ypm-hit-badge">{badge}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          forgetHit(h);
                        }}
                        aria-label={`Hapus ${h.title} dari riwayat`}
                        className="ypm-hit-rm"
                      >
                        <IconClose className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {hotWords.length > 0 && (
            <section className="ypm-search-sec">
              <div className="ypm-search-sec-head">
                <h2 className="ypm-search-sec-title">Pencarian Populer</h2>
              </div>
              {hasHistory ? (
                <div className="ypm-search-tags">
                  {hotWords.map((h) => (
                    <button
                      key={h.word}
                      type="button"
                      onClick={() => runSearch(h.word)}
                      className="ypm-search-tag"
                    >
                      {h.word}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="ypm-search-2col">
                  {hotWords.map((h, i) => (
                    <button
                      key={h.word}
                      type="button"
                      onClick={() => runSearch(h.word)}
                      className="ypm-hotword-row"
                    >
                      <span
                        className={`ypm-hotword-num ${i < 3 ? "is-top" : ""}`}
                      >
                        {i + 1}
                      </span>
                      <div className="ypm-hit-info">
                        <p className="ypm-hit-title">{h.word}</p>
                        <p className="ypm-hit-sub">{h.hint}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Mode Hasil Pencarian */}
      {urlQ && loading && !data && (
        <div className="ypm-search-loading" aria-busy="true">
          <div className="ypm-skel-rows">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ypm-skel ypm-skel-row" />
            ))}
          </div>
        </div>
      )}

      {urlQ && err && (
        <div className="ypm-lib-empty">
          <p className="ypm-lib-empty-title">Pencarian gagal dimuat</p>
          <p className="ypm-lib-empty-sub">{err}</p>
        </div>
      )}

      {urlQ && data && !loading && totalCount === 0 && (
        <div className="ypm-lib-empty">
          <p className="ypm-lib-empty-title">
            Tidak ada hasil untuk "{urlQ}"
          </p>
          <p className="ypm-lib-empty-sub">
            Coba kata kunci lain atau periksa ejaannya.
          </p>
        </div>
      )}

      {urlQ && data && totalCount > 0 && (
        <div className="ypm-sr">
          {/* 5 LineTabs seperti YesPlayMusic SearchResults */}
          <div className="ypm-sr-tabs" role="tablist" aria-label="Kategori hasil">
            {[
              { id: "all", label: "Semua", count: null },
              { id: "songs", label: "Lagu", count: data.songs.length },
              { id: "albums", label: "Album", count: data.albums.length },
              { id: "artists", label: "Artis", count: data.artists.length },
              { id: "videos", label: "Video", count: data.videos.length },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`ypm-sr-tab ${tab === t.id ? "is-active" : ""}`}
              >
                <span>{t.label}</span>
                {t.count !== null && (
                  <sup className="ypm-lib-count">{t.count}</sup>
                )}
              </button>
            ))}
          </div>

          {/* Tab Semua: Layout 2 Kolom (Kiri: Lagu & Album, Kanan: Artis & Video) */}
          {tab === "all" && (
            <div className="ypm-sr-all">
              <div className="ypm-sr-all-left">
                {data.songs.length > 0 && (
                  <section className="ypm-sr-block">
                    <div className="ypm-search-sec-head">
                      <h2 className="ypm-search-sec-title">Lagu</h2>
                    </div>
                    <div className="ypm-sr-song-list">
                      {data.songs
                        .slice(0, 5)
                        .map((t, i) => renderSongRow(t, i, data.songs))}
                    </div>
                    {data.songs.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setTab("songs")}
                        className="ypm-sr-seeall"
                      >
                        Lihat semua {data.songs.length} lagu
                      </button>
                    )}
                  </section>
                )}

                {data.albums.length > 0 && (
                  <section className="ypm-sr-block">
                    <div className="ypm-search-sec-head">
                      <h2 className="ypm-search-sec-title">Album</h2>
                    </div>
                    {renderAlbums(data.albums, 6)}
                    {data.albums.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setTab("albums")}
                        className="ypm-sr-seeall"
                      >
                        Lihat semua {data.albums.length} album
                      </button>
                    )}
                  </section>
                )}
              </div>

              {(data.artists.length > 0 || data.videos.length > 0) && (
                <aside className="ypm-sr-all-right">
                  {data.artists.length > 0 && (
                    <section className="ypm-sr-block">
                      <div className="ypm-search-sec-head">
                        <h2 className="ypm-search-sec-title">Artis</h2>
                        <button
                          type="button"
                          onClick={() => setTab("artists")}
                          className="ypm-search-sec-act ypm-sr-more-link"
                        >
                          <span>Semua ({data.artists.length})</span>
                          <IconChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {renderArtists(data.artists, 3)}
                    </section>
                  )}

                  {data.videos.length > 0 && (
                    <section className="ypm-sr-block">
                      <div className="ypm-search-sec-head">
                        <h2 className="ypm-search-sec-title">Video</h2>
                        <button
                          type="button"
                          onClick={() => setTab("videos")}
                          className="ypm-search-sec-act ypm-sr-more-link"
                        >
                          <span>Semua ({data.videos.length})</span>
                          <IconChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {renderVideos(data.videos, 4)}
                    </section>
                  )}
                </aside>
              )}
            </div>
          )}

          {tab === "songs" && (
            <div className="ypm-sr-song-list">
              {data.songs.length > 0 ? (
                data.songs.map((t, i) => renderSongRow(t, i, data.songs))
              ) : (
                <p className="ypm-lib-empty-sub">Tidak ada lagu ditemukan.</p>
              )}
            </div>
          )}

          {tab === "albums" &&
            (data.albums.length > 0 ? (
              renderAlbums(data.albums, data.albums.length)
            ) : (
              <p className="ypm-lib-empty-sub">Tidak ada album ditemukan.</p>
            ))}

          {tab === "artists" && (
            <div className="ypm-sr-narrow">
              {data.artists.length > 0 ? (
                renderArtists(data.artists, data.artists.length)
              ) : (
                <p className="ypm-lib-empty-sub">Tidak ada artis ditemukan.</p>
              )}
            </div>
          )}

          {tab === "videos" && (
            <div className="ypm-sr-narrow">
              {data.videos.length > 0 ? (
                renderVideos(data.videos, data.videos.length)
              ) : (
                <p className="ypm-lib-empty-sub">Tidak ada video ditemukan.</p>
              )}
            </div>
          )}
        </div>
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
