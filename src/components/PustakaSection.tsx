"use client";

import { usePlayer } from "@/lib/player";
import { LibraryView, type Section } from "@/components/LibraryView";
import {
  IconHeart,
  IconLibAlbum,
  IconLibArtists,
  IconLibPlaylists,
  IconLibRecent,
} from "@/components/Icons";

const SECTIONS: Record<
  Section,
  { label: string; icon: typeof IconLibPlaylists; hint: string }
> = {
  playlist: { label: "Playlist", icon: IconLibPlaylists, hint: "Koleksi yang kamu susun sendiri" },
  artist: { label: "Artis", icon: IconLibArtists, hint: "Artis dari lagu favoritmu" },
  album: { label: "Album", icon: IconLibAlbum, hint: "Album dari lagu favoritmu" },
  song: { label: "Lagu Favorit", icon: IconHeart, hint: "Lagu yang kamu tandai" },
  recent: { label: "Terakhir Diputar", icon: IconLibRecent, hint: "Riwayat putar di perangkat ini" },
};

function isSection(value: string): value is Section {
  return Object.prototype.hasOwnProperty.call(SECTIONS, value);
}

/** Satu halaman shortcut Pustaka. Dipakai web (/pustaka/[section]) dan desktop. */
export function PustakaSection({ section }: { section: string }) {
  const p = usePlayer();
  const key: Section = isSection(section) ? section : "playlist";
  const meta = SECTIONS[key];
  const Icon = meta.icon;

  const count =
    key === "playlist"
      ? `${p.playlists.length} playlist`
      : key === "song"
        ? `${p.liked.length} lagu`
        : key === "recent"
          ? `${p.recent.length} lagu`
          : `${p.liked.length} lagu favorit`;

  return (
    <div>
      <header className="mb-6">
        <div className="mb-3 flex items-center gap-2.5 text-accent">
          <span className="glass flex h-10 w-10 items-center justify-center rounded-[13px]">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <h1 className="t-large">{meta.label}</h1>
        <p className="mt-1.5 text-[15px] leading-snug text-label2">
          {meta.hint} · {count}
        </p>
      </header>

      <LibraryView initialSection={key} />
    </div>
  );
}
