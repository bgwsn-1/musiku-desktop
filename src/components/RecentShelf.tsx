"use client";

import { usePlayer } from "@/lib/player";
import { GridCard, Shelf } from "@/components/GridCard";

/** Baris "Dengarkan lagi" — hanya muncul bila ada riwayat lokal. */
export function RecentShelf() {
  const p = usePlayer();
  if (!p.recent.length) return null;
  return (
    <Shelf title="Dengarkan lagi">
      {p.recent.slice(0, 12).map((t, i) => (
        <GridCard
          key={`${t.videoId}-${i}`}
          title={t.title}
          subtitle={t.artist}
          img={t.thumbs}
          track={t}
          queue={p.recent}
        />
      ))}
    </Shelf>
  );
}
