"use client";

/**
 * Halaman Beranda: hero artis #1 global, filter mood (Bersantai/Sedih/Senang/
 * Tidur/dst dari YouTube Music), dan rak-rak /api/home dengan transisi.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { GridCard, Shelf } from "@/components/GridCard";
import { FeaturedCarousel, SongColumns } from "@/components/HomeFeatured";
import { RecentShelf } from "@/components/RecentShelf";
import { ArtistVideo } from "@/components/ArtistVideo";
import type { HomeItem, HomeShelf } from "@/lib/types";

type TopArtist = {
  browseId: string;
  title: string;
  thumbs?: string | null;
  banner?: string | null;
  videoId?: string | null;
  subscribers: number;
  monthly?: string | null;
};

type Mood = { id: string; title: string; color?: string | null };

type MoodPlaylist = {
  browseId: string;
  title: string;
  thumbs?: string | null;
  subtitle?: string | null;
  tracks?: number | null;
};

/** Mood YouTube Music umumnya Inggris; petakan ke bahasa sehari-hari. */
const MOOD_LABELS: Record<string, string> = {
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

function moodLabel(name: string): string {
  return MOOD_LABELS[name.trim().toLowerCase()] ?? name;
}

/** 44_800_000 -> "44,8 jt" */
function fmtCount(n: number): string {
  if (!n) return "";
  const trim = (s: string) => s.replace(/\.0$/, "");
  if (n >= 1e9) return `${trim((n / 1e9).toFixed(1))} M`;
  if (n >= 1e6) return `${trim((n / 1e6).toFixed(1))} jt`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(n);
}

export function HomeFeed({ shelves }: { shelves: HomeShelf[] }) {
  const [sel, setSel] = useState("");
  const [moods, setMoods] = useState<Mood[]>([]);
  const [playlists, setPlaylists] = useState<MoodPlaylist[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [top, setTop] = useState<TopArtist | null>(null);

  const lead = shelves[0];
  const songsIdx = shelves.findIndex(
    (s, i) => i > 0 && s.items.filter((x) => x.videoId).length >= 3,
  );
  const songs = songsIdx > 0 ? shelves[songsIdx] : undefined;
  const rest = shelves.filter((_, i) => i !== 0 && i !== songsIdx);

  // Daftar mood dari server (YouTube Music).
  useEffect(() => {
    let live = true;
    fetch("/api/moods")
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (live && Array.isArray(list)) setMoods(list as Mood[]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Isi playlist untuk mood terpilih.
  useEffect(() => {
    if (!sel) {
      setPlaylists(null);
      return;
    }
    let live = true;
    setLoading(true);
    setPlaylists(null);
    fetch(`/api/mood/${encodeURIComponent(sel)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!live) return;
        setPlaylists(Array.isArray(list) ? (list as MoodPlaylist[]) : []);
      })
      .catch(() => live && setPlaylists([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [sel]);

  // Hero artis #1 global (peringkat charts lintas-region).
  useEffect(() => {
    let live = true;
    setTop(null);
    fetch("/api/artists/charts")
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!live || !Array.isArray(list) || list.length === 0) return;
        const first = list[0] as TopArtist;
        setTop(first);
        fetch(`/api/artist/${first.browseId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
          .then((d) => {
            if (!live || !d) return;
            setTop((cur) =>
              cur && cur.browseId === first.browseId
                ? {
                    ...cur,
                    monthly: d.monthlyListeners ?? null,
                    videoId: d.topVideoId ?? null,
                    banner: d.banner ?? null,
                  }
                : cur,
            );
          });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const selMood = moods.find((m) => m.id === sel);

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Beranda</h1>
      </header>

      {top && (
        <section aria-label="Artis paling banyak diputar" className="mb-5">
          <Link
            href={`/artist/${top.browseId}`}
            className="card-anim artist-hero group relative block h-[176px] overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-fill1 text-left [margin:0]"
            aria-label={`${top.title}, ${
              top.monthly ?? `${fmtCount(top.subscribers)} pelanggan`
            }`}
          >
            {(top.banner || top.thumbs) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={top.banner ?? top.thumbs ?? ""}
                alt=""
                aria-hidden="true"
                className="artist-hero-img"
                loading="eager"
              />
            )}
            {/* header bergerak seperti halaman detail artis */}
            <ArtistVideo videoId={top.videoId} />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
              aria-hidden="true"
            />
            {/* fade lembut di tepi bawah kartu */}
            <div className="artist-hero-fade" aria-hidden="true" />

            <span className="relative flex h-full flex-col justify-end p-4 pb-[calc(var(--hero-fade)*0.6)]">
              <span className="t-eyebrow !text-white/75">Artis · #1 Global</span>
              <span className="mt-1 truncate text-[22px] font-bold leading-tight text-white">
                {top.title}
              </span>
              <span className="mt-0.5 truncate text-[13px] text-white/80">
                {top.monthly
                  ? top.monthly
                  : fmtCount(top.subscribers)
                    ? `${fmtCount(top.subscribers)} pelanggan`
                    : "Paling banyak diputar"}
              </span>
            </span>
          </Link>
        </section>
      )}

      <div
        className="no-scrollbar -mx-1 mb-6 flex max-w-full overflow-x-auto px-1"
        role="group"
        aria-label="Saring beranda berdasarkan mood"
      >
        <div className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-fill1 p-1">
          {[{ id: "", title: "Semua" }, ...moods].map((m) => (
            <button
              key={m.id || "all"}
              onClick={() => setSel(m.id)}
              aria-pressed={sel === m.id}
              className={`h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors ${
                sel === m.id
                  ? "bg-[var(--seg-thumb)] text-label1 shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                  : "text-label2 hover:text-label1"
              }`}
            >
              {m.title === "Semua" ? "Semua" : moodLabel(m.title)}
            </button>
          ))}
        </div>
      </div>

      <div key={sel} className="home-swap">
        {!sel ? (
          <>
            {lead && lead.items.length > 0 && (
              <FeaturedCarousel items={lead.items.slice(0, 6)} />
            )}

            {songs && (
              <SongColumns
                title={songs.title || "Lagu Terbaru"}
                items={songs.items.slice(0, 12)}
              />
            )}

            <RecentShelf />

            {rest.map((sh, si) => (
              <Shelf key={sh.title ?? si} title={sh.title ?? ""}>
                {sh.items.map((it, i) => {
                  if (it.kind === "artist" && it.browseId) {
                    return (
                      <GridCard
                        key={`ar${i}-${it.browseId}`}
                        i={i}
                        title={it.title}
                        subtitle={it.artist}
                        href={`/artist/${it.browseId}`}
                        img={it.thumbs}
                        round
                      />
                    );
                  }
                  if (it.kind === "album" && it.browseId) {
                    return (
                      <GridCard
                        key={`al${i}-${it.browseId}`}
                        i={i}
                        title={it.title}
                        subtitle={it.artist}
                        href={`/album/${it.browseId}`}
                        img={it.thumbs}
                      />
                    );
                  }
                  return (
                    <GridCard
                      key={`s${i}-${it.videoId ?? i}`}
                      i={i}
                      title={it.title}
                      subtitle={it.artist}
                      href={
                        it.kind === "album" && it.browseId
                          ? `/album/${it.browseId}`
                          : undefined
                      }
                      img={it.thumbs}
                      track={
                        it.videoId
                          ? {
                              videoId: it.videoId,
                              title: it.title,
                              artist: it.artist,
                              artistId: it.artistId,
                              thumbs: it.thumbs,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </Shelf>
            ))}
          </>
        ) : (
          <section aria-label={selMood ? moodLabel(selMood.title) : "Mood"}>
            <h2 className="t-title mb-3 text-label1">
              {selMood ? moodLabel(selMood.title) : "Mood"}
            </h2>
            {loading && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 min-[40rem]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square rounded-[14px] bg-fill1" />
                    <div className="mt-3 h-3.5 w-3/4 rounded bg-fill1" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-fill1" />
                  </div>
                ))}
              </div>
            )}
            {!loading && playlists && playlists.length === 0 && (
              <p className="py-10 text-center text-[15px] text-label2">
                Playlist mood ini belum tersedia.
              </p>
            )}
            {!loading && playlists && playlists.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 min-[40rem]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {playlists.slice(0, 24).map((pl, i) => (
                  <GridCard
                    key={pl.browseId}
                    i={i}
                    title={pl.title}
                    subtitle={
                      pl.tracks
                        ? `${pl.subtitle ?? "Playlist"} · ${pl.tracks} lagu`
                        : (pl.subtitle ?? "Playlist")
                    }
                    img={pl.thumbs}
                    href={`/ytm-playlist/${encodeURIComponent(pl.browseId)}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {!shelves.length && (
        <div className="py-24 text-center">
          <p className="text-[17px] font-semibold text-label1">Beranda belum bisa dimuat</p>
          <p className="mt-1 text-[15px] text-label2">
            Cek koneksi, lalu muat ulang. Kamu tetap bisa{" "}
            <a href="/search" className="font-semibold text-accent underline-offset-2 hover:underline">
              mencari lagu
            </a>
            .
          </p>
        </div>
      )}

      <p className="mt-4 text-[13px] leading-relaxed text-label3">
        Metadata dari YouTube Music. Favorit dan playlist tersimpan di perangkat ini, tanpa akun.
      </p>
    </div>
  );
}
