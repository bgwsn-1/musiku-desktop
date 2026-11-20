"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePlayer } from "@/lib/player";
import { TrackRow } from "@/components/TrackRow";
import { PlayAllButton, ShuffleButton } from "@/components/PlayAllButton";
import { MediaArt, MediaHeader } from "@/components/MediaHeader";
import { ConfirmDialog } from "@/components/Dialog";
import { IconMusic, IconTrash } from "@/components/Icons";
import type { Track } from "@/lib/types";

function Cover({ tracks }: { tracks: Track[] }) {
  const th = tracks.map((t) => t.thumbs).filter(Boolean) as string[];
  const box =
    "h-[208px] w-[208px] shrink-0 overflow-hidden rounded-[20px] shadow-[var(--shadow-art)] md:h-[232px] md:w-[232px]";
  if (th.length >= 4) {
    return (
      <div className={`${box} grid grid-cols-2 grid-rows-2 bg-fill2`}>
        {th.slice(0, 4).map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
    );
  }
  if (th.length) return <MediaArt src={th[0]} />;
  return (
    <div className={`${box} flex items-center justify-center bg-fill2 text-label3`} aria-hidden="true">
      <IconMusic className="h-16 w-16" />
    </div>
  );
}

/** Isi halaman playlist murni berdasarkan id. Dipakai web lewat `params` dan
 *  bundle desktop langsung dengan id — tanpa React `use()`/Suspense. */
export function PlaylistView({ id }: { id: string }) {
  const router = useRouter();
  const p = usePlayer();
  const pl = p.playlists.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(false);

  if (!pl) {
    return (
      <div className="py-24 text-center">
        <p className="text-[17px] font-semibold text-label1">Playlist tidak ada</p>
        <p className="mt-1 text-[15px] text-label2">Mungkin sudah dihapus dari perangkat ini.</p>
      </div>
    );
  }

  return (
    <div>
      <MediaHeader
        kind="Playlist"
        title={pl.name}
        backdrop={pl.tracks[0]?.thumbs}
        art={<Cover tracks={pl.tracks} />}
        meta={`${pl.tracks.length} lagu · tersimpan di perangkat ini`}
        actions={
          <>
            <PlayAllButton tracks={pl.tracks} />
            <ShuffleButton tracks={pl.tracks} />
            <button
              onClick={() => setConfirm(true)}
              className="btn btn-quiet is-danger !px-4"
              aria-label={`Hapus playlist ${pl.name}`}
            >
              <IconTrash className="h-4 w-4" />
              <span className="max-sm:sr-only">Hapus</span>
            </button>
          </>
        }
      />

      <section className="mt-10" aria-label="Daftar lagu">
        {pl.tracks.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-[17px] font-semibold text-label1">Playlist masih kosong</p>
            <p className="mt-1 text-[15px] text-label2">
              Tekan ⋯ di baris lagu mana pun, lalu pilih “Tambah ke playlist”.
            </p>
          </div>
        ) : (
          pl.tracks.map((t, i) => (
            <TrackRow
              key={`${t.videoId}-${i}`}
              track={t}
              queue={pl.tracks}
              index={i}
              onRemove={() => p.removeFromPlaylist(pl.id, t.videoId)}
            />
          ))
        )}
      </section>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Hapus “${pl.name}”?`}
        message="Playlist dihapus dari perangkat ini dan tidak bisa dikembalikan. Lagunya sendiri tidak ikut terhapus."
        confirmLabel="Hapus"
        onConfirm={() => {
          p.deletePlaylist(pl.id);
          router.push("/liked");
        }}
      />
    </div>
  );
}
