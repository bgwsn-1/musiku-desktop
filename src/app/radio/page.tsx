import { MUSIC } from "@/lib/music";
import { RadioStations } from "@/components/RadioStations";
import type { HomeItem, HomeShelf, Track } from "@/lib/types";

export const dynamic = "force-dynamic";

function toTrack(it: HomeItem): Track | undefined {
  return it.videoId
    ? {
        videoId: it.videoId,
        title: it.title,
        artist: it.artist,
        artistId: it.artistId,
        thumbs: it.thumbs,
      }
    : undefined;
}

export default async function RadioPage() {
  let shelves: HomeShelf[] = [];
  try {
    shelves = (await MUSIC.home()) as unknown as HomeShelf[];
  } catch {
    shelves = [];
  }

  const seen = new Set<string>();
  const tracks = shelves
    .flatMap((s) => s.items)
    .map(toTrack)
    .filter((t): t is Track => {
      if (!t || seen.has(t.videoId)) return false;
      seen.add(t.videoId);
      return true;
    });

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Radio</h1>
        <p className="mt-1 text-[15px] text-label2">Stasiun mix dari katalog dan favorit lokalmu.</p>
      </header>

      <RadioStations tracks={tracks} />

      <p className="mt-8 text-[13px] leading-relaxed text-label3">
        Stasiun menyusun antrean lagu dari perangkat ini, bukan siaran internet.
      </p>
    </div>
  );
}
