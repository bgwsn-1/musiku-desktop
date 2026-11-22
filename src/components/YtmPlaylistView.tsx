"use client";

/**
 * Halaman playlist YouTube Music (mis. playlist mood di Beranda).
 * Dipakai bersama oleh web (dengan data awal dari server) dan desktop
 * (mengambil sendiri dari /api/playlist/:id).
 */

import { useEffect, useState } from "react";
import { MediaArt, MediaHeader } from "@/components/MediaHeader";
import { PlayAllButton, ShuffleButton } from "@/components/PlayAllButton";
import { TrackRow } from "@/components/TrackRow";
import type { Track } from "@/lib/types";

export type RemotePlaylistData = {
  browseId: string;
  title: string;
  thumbs: string | null;
  owner: string | null;
  trackCount: number | null;
  tracks: Track[];
};

export function YtmPlaylistView({
  id,
  initial,
}: {
  id: string;
  initial?: RemotePlaylistData | null;
}) {
  const [data, setData] = useState<RemotePlaylistData | null>(initial ?? null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (initial) return;
    let live = true;
    setData(null);
    setMissing(false);
    fetch(`/api/playlist/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        if (d) setData(d as RemotePlaylistData);
        else setMissing(true);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id, initial]);

  if (missing) {
    return (
      <div className="py-24 text-center">
        <p className="text-[17px] font-semibold text-label1">Playlist tidak ditemukan</p>
        <p className="mt-1 text-[15px] text-label2">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="animate-pulse space-y-2 py-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-fill1" />
        ))}
      </div>
    );
  }

  const count = data.trackCount ?? data.tracks.length;

  return (
    <div>
      <MediaHeader
        kind="Playlist"
        title={data.title}
        backdrop={data.thumbs}
        art={<MediaArt src={data.thumbs} alt={`Sampul ${data.title}`} />}
        meta={
          <>
            {data.owner && (
              <span className="font-semibold text-label1">{data.owner}</span>
            )}
            {data.owner && count ? " · " : ""}
            {count ? `${count} lagu` : ""}
          </>
        }
        actions={
          <>
            <PlayAllButton tracks={data.tracks} />
            <ShuffleButton tracks={data.tracks} />
          </>
        }
      />

      <section className="mt-10" aria-label="Daftar lagu">
        {data.tracks.map((t, i) => (
          <TrackRow
            key={`${t.videoId}-${i}`}
            track={t}
            queue={data.tracks}
            index={i}
          />
        ))}
        {data.tracks.length === 0 && (
          <p className="py-10 text-center text-[15px] text-label2">
            Playlist ini belum memiliki lagu yang bisa dimuat.
          </p>
        )}
      </section>
    </div>
  );
}
