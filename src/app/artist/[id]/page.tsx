import { MUSIC } from "@/lib/music";
import { TrackRow } from "@/components/TrackRow";
import { GridCard, Shelf } from "@/components/GridCard";
import { PlayAllButton, ShuffleButton } from "@/components/PlayAllButton";
import { ArtistHeader } from "@/components/ArtistHeader";
import type { ArtistDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let artist: ArtistDetail | null = null;
  try {
    artist = (await MUSIC.artist(id)) as unknown as ArtistDetail;
  } catch {
    artist = null;
  }
  if (!artist || !artist.name) {
    return (
      <div className="py-24 text-center">
        <p className="text-[17px] font-semibold text-label1">Artis tidak ditemukan</p>
        <p className="mt-1 text-[15px] text-label2">Mungkin sudah dihapus atau tautannya salah.</p>
      </div>
    );
  }

  return (
    <div>
      <ArtistHeader
        name={artist.name}
        image={artist.banner ?? artist.thumbs}
        avatar={artist.avatar ?? artist.thumbs}
        videoId={artist.topVideoId}
        followers={artist.subscribers}
        monthly={artist.monthlyListeners}
        actions={
          <>
            <PlayAllButton tracks={artist.topSongs} />
            <ShuffleButton tracks={artist.topSongs} />
          </>
        }
      />

      {artist.topSongs.length > 0 && (
        <section className="mt-10" aria-label="Populer">
          <h2 className="t-title mb-2 text-label1">Populer</h2>
          {artist.topSongs.map((t, i) => (
            <TrackRow key={`${t.videoId}-${i}`} track={t} queue={artist.topSongs} index={i} showAlbum={false} />
          ))}
        </section>
      )}

      {artist.albums.length > 0 && (
        <div className="mt-12">
          <Shelf title="Album">
            {artist.albums.map((a, i) => (
              <GridCard
                key={`a${i}-${a.browseId}`}
                i={i}
                title={a.title}
                subtitle={a.year ?? undefined}
                href={a.browseId ? `/album/${a.browseId}` : undefined}
                img={a.thumbs}
              />
            ))}
          </Shelf>
        </div>
      )}

      {artist.singles.length > 0 && (
        <Shelf title="Single & EP">
          {artist.singles.map((a, i) => (
            <GridCard
              key={`s${i}-${a.browseId}`}
              i={i}
              title={a.title}
              subtitle={a.year ?? undefined}
              href={a.browseId ? `/album/${a.browseId}` : undefined}
              img={a.thumbs}
            />
          ))}
        </Shelf>
      )}

      {artist.desc && (
        <section className="mt-2" aria-label="Tentang">
          <h2 className="t-title mb-2 text-label1">Tentang</h2>
          <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-label2">
            {descSnippet(artist.desc)}
          </p>
        </section>
      )}
    </div>
  );
}

function descSnippet(d: string) {
  return d.length > 700 ? d.slice(0, 700).trimEnd() + "…" : d;
}
