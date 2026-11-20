import { MUSIC } from "@/lib/music";
import { GridCard, Shelf } from "@/components/GridCard";
import { FeaturedCarousel, SongColumns } from "@/components/HomeFeatured";
import { RecentShelf } from "@/components/RecentShelf";
import type { HomeShelf, Track } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let shelves: HomeShelf[] = [];
  try {
    shelves = (await MUSIC.home()) as unknown as HomeShelf[];
  } catch {
    shelves = [];
  }

  const lead = shelves[0];
  const songsIdx = shelves.findIndex((s, i) => i > 0 && s.items.filter((x) => x.videoId).length >= 3);
  const songs = songsIdx > 0 ? shelves[songsIdx] : undefined;
  const rest = shelves.filter((_, i) => i !== 0 && i !== songsIdx);

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Beranda</h1>
      </header>

      {lead && lead.items.length > 0 && <FeaturedCarousel items={lead.items.slice(0, 6)} />}

      {songs && <SongColumns title={songs.title || "Lagu Terbaru"} items={songs.items.slice(0, 12)} />}

      <RecentShelf />

      {rest.map((sh, si) => (
        <Shelf key={sh.title ?? si} title={sh.title ?? ""}>
          {sh.items.map((it, i) => {
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
            const track: Track | undefined = it.videoId
              ? {
                  videoId: it.videoId,
                  title: it.title,
                  artist: it.artist,
                  artistId: it.artistId,
                  thumbs: it.thumbs,
                }
              : undefined;
            return (
              <GridCard
                key={`s${i}-${it.videoId ?? i}`}
                i={i}
                title={it.title}
                subtitle={it.artist}
                href={it.browseId ? `/album/${it.browseId}` : undefined}
                img={it.thumbs}
                track={track}
              />
            );
          })}
        </Shelf>
      ))}

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
