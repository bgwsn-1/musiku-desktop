"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrackRow } from "@/components/TrackRow";
import { GridCard, Shelf } from "@/components/GridCard";
import { IconSearch } from "@/components/Icons";
import type { Track, AlbumSummary, ArtistDetail } from "@/lib/types";

type SearchShelf = {
  songs: Track[];
  videos: Track[];
  albums: AlbumSummary[];
  artists: ArtistDetail[];
};

const TABS = [
  ["all", "Semua"],
  ["songs", "Lagu"],
  ["videos", "Video"],
  ["albums", "Album"],
  ["artists", "Artis"],
] as const;

function SearchInner() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [tab, setTab] = useState<string>("all");
  const [data, setData] = useState<SearchShelf | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) {
      setData(null);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/search?q=${encodeURIComponent(q)}&filter=songs&limit=20`).then((r) => r.json()),
      fetch(`/api/search?q=${encodeURIComponent(q)}&filter=videos&limit=10`).then((r) => r.json()),
      fetch(`/api/search?q=${encodeURIComponent(q)}&filter=albums&limit=12`).then((r) => r.json()),
      fetch(`/api/search?q=${encodeURIComponent(q)}&filter=artists&limit=8`).then((r) => r.json()),
    ])
      .then(([songs, videos, albums, artists]) => {
        const tr = <T,>(a: T) => (Array.isArray(a) && !(a as { error?: string }).error ? a : []);
        setData({ songs: tr(songs), videos: tr(videos), albums: tr(albums), artists: tr(artists) });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [q]);

  if (!q) {
    return (
      <div className="py-24 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fill1 text-label2">
          <IconSearch className="h-6 w-6" />
        </span>
        <h1 className="text-[22px] font-bold tracking-tight text-label1">Cari apa hari ini?</h1>
        <p className="mt-1.5 text-[15px] text-label2">Lagu, artis, album, atau video. Ketik di kolom pencarian.</p>
      </div>
    );
  }

  const tabs = (
    <div
      className="no-scrollbar -mx-1 mb-8 flex max-w-full overflow-x-auto px-1"
      role="group"
      aria-label="Saring hasil"
    >
      <div className="inline-flex gap-1 rounded-full bg-fill1 p-1">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${
              tab === k
                ? "bg-[var(--seg-thumb)] text-label1 shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                : "text-label2 hover:text-label1"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="t-large mb-5 break-words">Hasil untuk “{q}”</h1>
      {tabs}

      {loading && !data && (
        <div className="animate-pulse space-y-2 py-4" aria-busy="true" aria-label="Memuat hasil">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-fill1" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-2">
          {(tab === "all" || tab === "songs") && data.songs.length > 0 && (
            <section>
              <h2 className="t-title mb-2 text-label1">Lagu</h2>
              <div>
                {data.songs.slice(0, tab === "all" ? 8 : 50).map((t, i) => (
                  <TrackRow key={`${t.videoId}-${i}`} track={t} queue={data.songs} index={i} />
                ))}
              </div>
            </section>
          )}

          {(tab === "all" || tab === "artists") && data.artists.length > 0 && (
            <Shelf title="Artis" layout="grid">
              {data.artists.map((a, ai) => (
                <GridCard
                  key={a.browseId}
                  i={ai}
                  title={a.name}
                  subtitle="Artis"
                  href={`/artist/${a.browseId}`}
                  img={a.thumbs}
                  round
                />
              ))}
            </Shelf>
          )}

          {(tab === "all" || tab === "albums") && data.albums.length > 0 && (
            <Shelf title="Album" layout="grid">
              {data.albums.map((a, ai) => (
                <GridCard
                  key={a.browseId}
                  i={ai}
                  title={a.title}
                  subtitle={`${(Array.isArray(a.artist) ? a.artist[0] : a.artist) ?? "Album"}${a.year ? ` • ${a.year}` : ""}`}
                  href={a.browseId ? `/album/${a.browseId}` : undefined}
                  img={a.thumbs}
                />
              ))}
            </Shelf>
          )}

          {(tab === "all" || tab === "videos") && data.videos.length > 0 && (
            <section>
              <h2 className="t-title mb-2 text-label1">Video</h2>
              <div>
                {data.videos.map((t, i) => (
                  <TrackRow key={`${t.videoId}-${i}`} track={t} queue={data.videos} index={i} />
                ))}
              </div>
            </section>
          )}

          {!data.songs.length && !data.albums.length && !data.artists.length && !data.videos.length && !loading && (
            <div className="py-20 text-center">
              <p className="text-[17px] font-semibold text-label1">Tidak ada hasil</p>
              <p className="mt-1 text-[15px] text-label2">Coba kata kunci lain atau periksa ejaannya.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[15px] text-label2">Memuat…</div>}>
      <SearchInner />
    </Suspense>
  );
}
