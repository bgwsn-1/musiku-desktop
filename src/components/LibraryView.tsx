"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { Artwork } from "@/components/Artwork";
import { GridCard } from "@/components/GridCard";
import { TrackRow } from "@/components/TrackRow";
import { NewPlaylistDialog } from "@/components/Dialog";
import { IconChevronRight, IconPlus } from "@/components/Icons";

type Section = "playlist" | "artist" | "album" | "song";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "playlist", label: "Playlist" },
  { id: "artist", label: "Artis" },
  { id: "album", label: "Album" },
  { id: "song", label: "Lagu" },
];

type ArtistGroup = {
  key: string;
  name: string;
  artistId: string | null;
  thumbs: string | null;
  count: number;
};

type AlbumGroup = {
  key: string;
  name: string;
  albumId: string | null;
  artist: string | null;
  thumbs: string | null;
  count: number;
};

/**
 * Pustaka: segmented control ala Apple Music (Playlist / Artis / Album / Lagu).
 * Artis dan album diturunkan dari lagu favorit di perangkat — tidak ada
 * permintaan jaringan tambahan, jadi section-nya instan.
 */
export function LibraryView() {
  const p = usePlayer();
  const router = useRouter();
  const [section, setSection] = useState<Section>("playlist");
  const [creating, setCreating] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const artists = useMemo<ArtistGroup[]>(() => {
    const map = new Map<string, ArtistGroup>();
    for (const t of p.liked) {
      const name = t.artist ?? t.artists?.[0] ?? null;
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      const g = map.get(key);
      if (g) {
        g.count += 1;
        g.thumbs ??= t.thumbs ?? null;
        g.artistId ??= t.artistId ?? null;
      } else {
        map.set(key, {
          key,
          name,
          artistId: t.artistId ?? null,
          thumbs: t.thumbs ?? null,
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [p.liked]);

  const albums = useMemo<AlbumGroup[]>(() => {
    const map = new Map<string, AlbumGroup>();
    for (const t of p.liked) {
      if (!t.album) continue;
      const artist = t.artist ?? t.artists?.[0] ?? null;
      const key = `${t.album.toLocaleLowerCase()}::${artist?.toLocaleLowerCase() ?? ""}`;
      const g = map.get(key);
      if (g) {
        g.count += 1;
        g.albumId ??= t.albumId ?? null;
        g.thumbs ??= t.thumbs ?? null;
      } else {
        map.set(key, {
          key,
          name: t.album,
          albumId: t.albumId ?? null,
          artist,
          thumbs: t.thumbs ?? null,
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [p.liked]);

  const select = (s: Section) => setSection(s);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = SECTIONS.findIndex((s) => s.id === section);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % SECTIONS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + SECTIONS.length) % SECTIONS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = SECTIONS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setSection(SECTIONS[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      {/* ── Segmented control: one track, one thumb, taps move it ── */}
      <div
        role="tablist"
        aria-label="Bagian pustaka"
        onKeyDown={onKeyDown}
        className="glass relative flex h-10 w-full max-w-[520px] rounded-full p-1"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-8px)/4)] rounded-full bg-[var(--seg-thumb)] shadow-[0_1px_3px_rgba(0,0,0,0.16)] transition-transform duration-[400ms] ease-[var(--ease-spring)]"
          style={{ transform: `translateX(${SECTIONS.findIndex((s) => s.id === section) * 100}%)` }}
        />
        {SECTIONS.map((s, i) => {
          const active = s.id === section;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              aria-selected={active}
              aria-controls={`library-panel-${s.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(s.id)}
              className={`relative z-10 flex-1 rounded-full text-[13px] transition-colors duration-200 ${
                active ? "font-semibold text-label1" : "font-medium text-label2"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {section === "playlist" && (
          <section id="library-panel-playlist" role="tabpanel" aria-label="Playlist">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <button
                onClick={() => setCreating(true)}
                className="group text-left"
                aria-label="Buat playlist baru"
              >
                <span className="mb-3 flex aspect-square w-full items-center justify-center rounded-[14px] border border-dashed border-[var(--hairline)] bg-fill1 text-label2 transition-colors group-hover:bg-fill2 group-hover:text-label1">
                  <IconPlus className="h-8 w-8" />
                </span>
                <span className="block truncate text-[15px] font-semibold leading-tight text-label1">
                  Playlist Baru
                </span>
                <span className="mt-0.5 block truncate text-[13px] leading-tight text-label2">
                  Buat koleksi lagu
                </span>
              </button>
              {p.playlists.map((pl, i) => (
                <GridCard
                  key={pl.id}
                  i={i + 1}
                  title={pl.name}
                  subtitle={`${pl.tracks.length} lagu`}
                  href={`/playlist/${pl.id}`}
                  img={pl.tracks[0]?.thumbs}
                />
              ))}
            </div>
            {!p.playlists.length && (
              <p className="mt-6 text-[15px] text-label2">
                Belum ada playlist. Tekan “Playlist Baru” untuk membuat yang pertama.
              </p>
            )}
          </section>
        )}

        {section === "artist" && (
          <section id="library-panel-artist" role="tabpanel" aria-label="Artis">
            {artists.length === 0 ? (
              <Empty
                title="Belum ada artis"
                body="Artis muncul di sini setelah kamu menyukai lagunya."
              />
            ) : (
              <ul className="divide-y divide-[var(--hairline)]">
                {artists.map((a) => (
                  <li key={a.key}>
                    <Link
                      href={
                        a.artistId
                          ? `/artist/${a.artistId}`
                          : `/search?q=${encodeURIComponent(a.name)}`
                      }
                      className="flex min-h-[60px] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-fill1"
                    >
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-fill2">
                        <Artwork src={a.thumbs} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-label1">
                          {a.name}
                        </span>
                        <span className="block text-[13px] text-label2">{a.count} lagu</span>
                      </span>
                      <IconChevronRight className="h-4 w-4 shrink-0 text-label3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {section === "album" && (
          <section id="library-panel-album" role="tabpanel" aria-label="Album">
            {albums.length === 0 ? (
              <Empty
                title="Belum ada album"
                body="Album muncul di sini setelah kamu menyukai lagu dari album tersebut."
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {albums.map((a, i) => (
                  <GridCard
                    key={a.key}
                    i={i}
                    title={a.name}
                    subtitle={a.artist ? `${a.artist} · ${a.count} lagu` : `${a.count} lagu`}
                    href={
                      a.albumId
                        ? `/album/${a.albumId}`
                        : `/search?q=${encodeURIComponent(a.name)}`
                    }
                    img={a.thumbs}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {section === "song" && (
          <section id="library-panel-song" role="tabpanel" aria-label="Lagu">
            {p.liked.length === 0 ? (
              <Empty
                title="Belum ada favorit"
                body="Tekan ikon hati di lagu mana pun, nanti muncul di sini."
              />
            ) : (
              p.liked.map((t, i) => (
                <TrackRow key={`${t.videoId}-${i}`} track={t} queue={p.liked} index={i} />
              ))
            )}
          </section>
        )}
      </div>

      <NewPlaylistDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(name) => {
          const id = p.createPlaylist(name);
          setCreating(false);
          setSection("playlist");
          router.push(`/playlist/${id}`);
        }}
      />
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-[17px] font-semibold text-label1">{title}</p>
      <p className="mx-auto mt-1 max-w-[36ch] text-[15px] leading-snug text-label2">{body}</p>
    </div>
  );
}
