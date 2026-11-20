"use client";

import { usePlayer } from "@/lib/player";
import { LibraryView } from "@/components/LibraryView";

export default function LikedPage() {
  const p = usePlayer();
  const songs = p.liked.length;
  const playlists = p.playlists.length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="t-large">Pustaka</h1>
        <p className="mt-1.5 text-[15px] leading-snug text-label2">
          {songs} lagu · {playlists} playlist · tersimpan di perangkat ini
        </p>
      </header>

      <LibraryView />
    </div>
  );
}
