"use client";

import { usePlayer } from "@/lib/player";
import { IconPause, IconPlay, IconShuffle } from "@/components/Icons";
import type { Track } from "@/lib/types";

/** The one prominent action on a page. */
export function PlayAllButton({
  tracks,
  label = "Putar",
}: {
  tracks: Track[];
  label?: string;
}) {
  const p = usePlayer();
  const isThisQueue = !!p.current && tracks.some((t) => t.videoId === p.current?.videoId);
  const playing = isThisQueue && p.playing;
  return (
    <button
      onClick={() => (isThisQueue ? p.toggle() : p.playTracks(tracks, 0))}
      disabled={!tracks.length}
      className="btn btn-primary min-w-[132px]"
    >
      {playing ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
      {playing ? "Jeda" : label}
    </button>
  );
}

export function ShuffleButton({ tracks }: { tracks: Track[] }) {
  const p = usePlayer();
  return (
    <button
      onClick={() => {
        if (!tracks.length) return;
        const a = [...tracks];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        p.playTracks(a, 0);
      }}
      disabled={tracks.length < 2}
      className="btn btn-quiet"
    >
      <IconShuffle className="h-4 w-4" />
      Acak
    </button>
  );
}
