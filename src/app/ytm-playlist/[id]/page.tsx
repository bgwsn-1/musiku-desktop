import { MUSIC } from "@/lib/music";
import { YtmPlaylistView } from "@/components/YtmPlaylistView";

export const dynamic = "force-dynamic";

export default async function YtmPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data = null;
  try {
    data = (await MUSIC.ytmPlaylist(id)) as never;
  } catch {
    data = null;
  }
  if (!data) {
    return (
      <div className="py-24 text-center">
        <p className="text-[17px] font-semibold text-label1">Playlist tidak ditemukan</p>
        <p className="mt-1 text-[15px] text-label2">
          Mungkin sudah dihapus atau tautannya salah.
        </p>
      </div>
    );
  }
  return <YtmPlaylistView id={id} initial={data} />;
}
