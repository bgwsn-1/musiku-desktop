"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { fmtTime, usePlayer } from "@/lib/player";
import type { Track } from "@/lib/types";
import { Artwork } from "@/components/Artwork";
import { IconEllipsis, IconHeart, IconPause, IconPlay } from "@/components/Icons";
import { TrackMenu, type MenuAnchor } from "@/components/TrackMenu";
import { Dialog } from "@/components/Dialog";
import { toast } from "@/components/Toast";

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className={`eq ${playing ? "on" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

const act =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label3 hover:bg-fill2 hover:text-label1 pointer-coarse:h-11 pointer-coarse:w-11";

/**
 * One song. Playing state is a shape (equalizer) plus colour. Every action is
 * reachable on touch and by keyboard: nothing lives only behind :hover.
 */
export function TrackRow({
  track,
  queue,
  index = 0,
  showAlbum = true,
  showIndex = true,
  onRemove,
}: {
  track: Track;
  queue?: Track[];
  index?: number;
  showAlbum?: boolean;
  showIndex?: boolean;
  onRemove?: () => void;
}) {
  const p = usePlayer();
  const isCurrent = p.current?.videoId === track.videoId;
  const playing = isCurrent && p.playing;
  const liked = p.isLiked(track.videoId);
  const [addOpen, setAddOpen] = useState(false);
  const [ctx, setCtx] = useState<MenuAnchor | null>(null);
  const [pop, setPop] = useState(false);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const openCtx = (a: MenuAnchor) => setCtx((cur) => cur ?? a);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  const play = () => (isCurrent ? p.toggle() : p.playOne(track, queue));
  const dur = typeof track.duration === "number" ? fmtTime(track.duration) : (track.duration ?? "");

  const cols = showAlbum
    ? "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[32px_minmax(0,1fr)_auto] lg:grid-cols-[32px_minmax(0,1.3fr)_minmax(0,1fr)_auto]"
    : "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[32px_minmax(0,1fr)_auto]";

  return (
    <div
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
      className={`card-anim group grid select-none [-webkit-touch-callout:none] ${cols} min-h-[60px] items-center gap-x-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-fill1 ${
        isCurrent ? "bg-fill1" : ""
      }`}
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button,input")) p.playOne(track, queue);
      }}
      // right-click, or long-press (Android fires contextmenu itself; iOS needs the timer below)
      onContextMenu={(e) => {
        e.preventDefault();
        openCtx({ x: e.clientX, y: e.clientY });
      }}
      onTouchStart={(e) => {
        if (e.touches.length !== 1 || (e.target as HTMLElement).closest("input")) return;
        const t = e.touches[0];
        cancelPress();
        press.current = {
          x: t.clientX,
          y: t.clientY,
          timer: setTimeout(() => {
            suppressClick.current = true;
            setTimeout(() => (suppressClick.current = false), 700);
            navigator.vibrate?.(12);
            openCtx({ x: t.clientX, y: t.clientY });
            press.current = null;
          }, 480),
        };
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (press.current && Math.hypot(t.clientX - press.current.x, t.clientY - press.current.y) > 10) cancelPress();
      }}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}
    >
      {/* index → play on hover/focus (always focusable) */}
      <button
        onClick={play}
        className="relative hidden h-9 w-8 items-center justify-center text-[14px] text-label3 md:flex"
        aria-label={`${playing ? "Jeda" : "Putar"} ${track.title}`}
      >
        <span className={`tnum transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 ${isCurrent ? "opacity-0" : ""}`}>
          {showIndex ? index + 1 : ""}
        </span>
        {isCurrent && (
          <span className="absolute inset-0 flex items-center justify-center text-accent transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
            <Equalizer playing={playing} />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center text-label1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {playing ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
        </span>
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={play}
          className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-fill2 md:h-11 md:w-11"
          aria-label={`${playing ? "Jeda" : "Putar"} ${track.title}`}
          tabIndex={-1}
        >
          <Artwork src={track.thumbs} />
          {isCurrent && (
            <span className="glass-clear absolute inset-0 flex items-center justify-center md:hidden">
              <Equalizer playing={playing} />
            </span>
          )}
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={play}
              className={`min-w-0 truncate text-left text-[15px] font-semibold leading-tight ${
                isCurrent ? "text-accent" : "text-label1"
              }`}
              title={track.title}
            >
              {track.title}
            </button>
            {track.isExplicit && (
              <span
                className="inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] bg-fill2 text-[11px] font-bold leading-none text-label2"
                aria-label="Eksplisit"
                role="img"
              >
                E
              </span>
            )}
          </div>
          {track.artist && <ArtistLink name={track.artist} artistId={track.artistId} />}
        </div>
      </div>

      {showAlbum && (
        <div className="hidden min-w-0 truncate text-[14px] text-label2 lg:block">
          {track.album ? (
            track.albumId ? (
              <Link href={`/album/${track.albumId}`} className="hover:text-label1 hover:underline">
                {track.album}
              </Link>
            ) : (
              track.album
            )
          ) : (
            ""
          )}
        </div>
      )}

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => {
            if (!liked) {
              setPop(true);
              setTimeout(() => setPop(false), 600);
            }
            p.toggleLike(track);
          }}
          className={`reveal ${act} ${liked ? "!text-accent" : ""} ${pop ? "heart-pop" : ""}`}
          aria-label={liked ? "Hapus dari favorit" : "Tambahkan ke favorit"}
          aria-pressed={liked}
        >
          <IconHeart filled={liked} className="h-[18px] w-[18px]" />
        </button>
        <span className="hidden min-w-[44px] text-right text-[14px] text-label3 tnum sm:inline">{dur}</span>
        <button
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setCtx({ x: r.right, y: r.bottom + 4, end: true });
          }}
          className={`reveal ${act}`}
          aria-haspopup="menu"
          aria-label={`Aksi untuk ${track.title}`}
        >
          <IconEllipsis className="h-[18px] w-[18px]" />
        </button>
      </div>

      {ctx && (
        <TrackMenu
          track={track}
          anchor={ctx}
          onClose={() => setCtx(null)}
          onAddToPlaylist={() => setAddOpen(true)}
          onRemove={onRemove}
        />
      )}
      {addOpen && <AddToPlaylistMenu track={track} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

export function ArtistLink({ name, artistId }: { name: string; artistId?: string | null }) {
  return (
    <Link
      href={artistId ? `/artist/${artistId}` : `/search?q=${encodeURIComponent(name)}`}
      className="block truncate text-[13px] leading-tight text-label2 hover:text-label1 hover:underline"
    >
      {name}
    </Link>
  );
}

export function AddToPlaylistMenu({ track, onClose }: { track: Track; onClose: () => void }) {
  const p = usePlayer();
  const [name, setName] = useState("");
  const done = (plName: string) => {
    toast(`Ditambahkan ke ${plName}`);
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Tambah ke playlist">
      <div className="-mx-2 max-h-[40dvh] space-y-0.5 overflow-y-auto px-2">
        {p.playlists.map((pl, k) => (
          <button
            key={pl.id}
            data-autofocus={k === 0 ? "" : undefined}
            onClick={() => {
              p.addToPlaylist(pl.id, track);
              done(pl.name);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-fill1"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-fill2 text-label3">
              <Artwork src={pl.tracks[0]?.thumbs} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-label1">{pl.name}</span>
            <span className="text-[13px] text-label3">{pl.tracks.length}</span>
          </button>
        ))}
        {!p.playlists.length && (
          <p className="py-3 text-[14px] text-label2">Belum ada playlist. Buat yang pertama di bawah.</p>
        )}
      </div>
      <form
        className="mt-3 flex gap-2 border-t border-[var(--hairline)] pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = p.createPlaylist(name.trim());
          p.addToPlaylist(id, track);
          done(name.trim());
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Playlist baru"
          aria-label="Nama playlist baru"
          data-autofocus={p.playlists.length ? undefined : ""}
          maxLength={80}
          className="h-11 min-w-0 flex-1 rounded-xl bg-fill1 px-4 text-[15px] text-label1 outline-none placeholder:text-label3 focus:bg-fill2 focus:ring-2 focus:ring-accent"
        />
        <button type="submit" disabled={!name.trim()} className="btn btn-primary !px-5">
          Buat
        </button>
      </form>
    </Dialog>
  );
}

/** Kept for compatibility: a favourite is just a row whose heart is on. */
export function LikedRow({ track, queue, index }: { track: Track; queue?: Track[]; index?: number }) {
  return <TrackRow track={track} queue={queue} index={index} />;
}
