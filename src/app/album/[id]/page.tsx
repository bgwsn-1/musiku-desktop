import Link from "next/link";
import { MUSIC } from "@/lib/music";
import { TrackRow } from "@/components/TrackRow";
import { PlayAllButton, ShuffleButton } from "@/components/PlayAllButton";
import { MediaArt, MediaHeader } from "@/components/MediaHeader";
import type { AlbumDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let album: AlbumDetail | null = null;
  try {
    album = (await MUSIC.album(id)) as unknown as AlbumDetail;
  } catch {
    album = null;
  }
  if (!album || !album.title) {
    return (
      <div className="py-24 text-center">
        <p className="text-[17px] font-semibold text-label1">Album tidak ditemukan</p>
        <p className="mt-1 text-[15px] text-label2">Mungkin sudah dihapus atau tautannya salah.</p>
      </div>
    );
  }
  const artistName = Array.isArray(album.artist) ? album.artist[0] : album.artist;
  const facts = [album.year, album.duration, album.tracks.length ? `${album.tracks.length} lagu` : null].filter(Boolean);

  return (
    <div>
      <MediaHeader
        kind="Album"
        title={album.title}
        backdrop={album.thumbs}
        art={<MediaArt src={album.thumbs} alt={`Sampul ${album.title}`} />}
        meta={
          <>
            {artistName &&
              (album.artistId ? (
                <Link href={`/artist/${album.artistId}`} className="font-semibold text-label1 hover:underline">
                  {artistName}
                </Link>
              ) : (
                <span className="font-semibold text-label1">{artistName}</span>
              ))}
            {artistName && facts.length > 0 && " · "}
            {facts.join(" · ")}
          </>
        }
        actions={
          <>
            <PlayAllButton tracks={album.tracks} />
            <ShuffleButton tracks={album.tracks} />
          </>
        }
      />

      <section className="mt-10" aria-label="Daftar lagu">
        {album.tracks.map((t, i) => (
          <TrackRow
            key={`${t.videoId}-${i}`}
            track={{ ...t, album: t.album || album.title, albumId: album.browseId }}
            queue={album.tracks}
            index={i}
          />
        ))}
      </section>
    </div>
  );
}
