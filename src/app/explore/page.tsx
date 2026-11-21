import { MUSIC } from "@/lib/music";
import { GridCard, Shelf } from "@/components/GridCard";
import { FeaturedCarousel } from "@/components/HomeFeatured";
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

function uniqueBy<T>(items: T[], key: (item: T) => string | null): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export default async function ExplorePage() {
  let shelves: HomeShelf[] = [];
  try {
    shelves = (await MUSIC.home()) as unknown as HomeShelf[];
  } catch {
    shelves = [];
  }

  const items = shelves.flatMap((s) => s.items);
  const artists = uniqueBy(
    items.filter((it) => it.kind === "artist"),
    (it) => it.browseId,
  );
  const albums = uniqueBy(
    items.filter((it) => it.kind === "album"),
    (it) => it.browseId,
  );
  const songs = uniqueBy(
    items.filter((it) => it.videoId),
    (it) => it.videoId,
  ).slice(0, 24);
  const songTracks = songs.map(toTrack).filter(Boolean) as Track[];
  const lead = shelves[0];

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Explore</h1>
        <p className="mt-1 text-[15px] text-label2">Album dan lagu pilihan dari katalog Musiku.</p>
      </header>

      {lead && lead.items.length > 0 && <FeaturedCarousel items={lead.items.slice(0, 6)} />}

      {artists.length > 0 && (
        <Shelf title="Artis populer" layout="grid">
          {artists.slice(0, 24).map((it, i) => (
            <GridCard
              key={`ar-${i}-${it.browseId}`}
              i={i}
              title={it.title}
              subtitle={it.artist}
              href={`/artist/${it.browseId}`}
              img={it.thumbs}
              round
            />
          ))}
        </Shelf>
      )}

      {albums.length > 0 && (
        <Shelf title="Album pilihan" layout="grid">
          {albums.slice(0, 24).map((it, i) => (
            <GridCard
              key={`al-${i}-${it.browseId}`}
              i={i}
              title={it.title}
              subtitle={it.artist}
              href={`/album/${it.browseId}`}
              img={it.thumbs}
            />
          ))}
        </Shelf>
      )}

      {songs.length > 0 && (
        <Shelf title="Lagu untuk mulai" layout="grid">
          {songs.map((it, i) => {
            const track = toTrack(it);
            if (!track) return null;
            return (
              <GridCard
                key={`song-${i}-${track.videoId}`}
                i={i}
                title={track.title}
                subtitle={track.artist}
                img={track.thumbs}
                track={track}
                queue={songTracks}
              />
            );
          })}
        </Shelf>
      )}

      {!items.length && (
        <div className="py-24 text-center">
          <p className="text-[17px] font-semibold text-label1">Explore belum bisa dimuat</p>
          <p className="mt-1.5 text-[15px] text-label2">
            Cek koneksi, lalu muat ulang. Kamu tetap bisa{" "}
            <a href="/search" className="font-semibold text-accent underline-offset-2 hover:underline">
              mencari lagu
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
