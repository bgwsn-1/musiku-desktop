"use client";

import { usePlayer } from "@/lib/player";
import { Artwork } from "@/components/Artwork";
import { IconPlay } from "@/components/Icons";
import type { Track } from "@/lib/types";

type Station = {
  name: string;
  desc: string;
  tracks: Track[];
  img?: string | null;
};

export function RadioStations({ tracks }: { tracks: Track[] }) {
  const p = usePlayer();
  const byArtist = tracks.filter(
    (t, i, all) => t.artist && all.findIndex((x) => x.artist === t.artist) === i,
  );
  const favorites = p.liked.length >= 3 ? p.liked : tracks.slice(20, 40);

  const stations: Station[] = [
    {
      name: "Beranda Mix",
      desc: "Lagu yang sedang jadi pilihan di Musiku.",
      tracks: tracks.slice(0, 20),
      img: tracks[0]?.thumbs,
    },
    {
      name: "Favorit Mix",
      desc:
        p.liked.length >= 3
          ? "Lagu yang pernah kamu tandai favorit."
          : "Kumpulan lagu dari katalog Musiku.",
      tracks: favorites,
      img: favorites[0]?.thumbs,
    },
    {
      name: "Satu per Artis",
      desc: "Satu lagu dari tiap artis yang ada di beranda.",
      tracks: byArtist.slice(0, 20),
      img: byArtist[0]?.thumbs,
    },
  ].filter((s) => s.tracks.length > 0);

  if (!stations.length) {
    return (
      <div className="py-24 text-center">
        <p className="text-[17px] font-semibold text-label1">Radio belum bisa dimuat</p>
        <p className="mt-1.5 text-[15px] text-label2">
          Cek koneksi, lalu muat ulang halaman ini.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 min-[40rem]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {stations.map((s, i) => (
        <button
          key={s.name}
          onClick={() => p.playTracks(s.tracks, 0)}
          aria-label={`Putar stasiun ${s.name}`}
          className="card-anim group text-left focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent focus-visible:outline-offset-2"
          style={{ "--i": i } as React.CSSProperties}
        >
          <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-[14px] bg-fill1 shadow-[var(--shadow-art)] transition-shadow duration-500 group-hover:shadow-[0_18px_36px_-12px_rgba(0,0,0,0.5)] group-active:scale-[0.98] motion-reduce:scale-100 motion-reduce:transition-none">
            <Artwork src={s.img} className="h-full w-full object-cover" />
            <span
              aria-hidden="true"
              className="glass-clear absolute bottom-2.5 left-2.5 flex h-10 w-10 items-center justify-center rounded-full"
            >
              <IconPlay className="ml-0.5 h-4 w-4" />
            </span>
          </div>
          <div className="truncate text-[15px] font-semibold leading-tight text-label1">{s.name}</div>
          <div className="mt-0.5 truncate text-[13px] leading-tight text-label2">{s.desc}</div>
        </button>
      ))}
    </div>
  );
}
