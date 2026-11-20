"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { IconChevronRight, IconEllipsis, IconPause, IconPlay } from "@/components/Icons";
import { TrackMenu, type MenuAnchor } from "@/components/TrackMenu";
import { Artwork } from "@/components/Artwork";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import type { HomeItem, Track } from "@/lib/types";

function toTrack(it: HomeItem): Track | undefined {
  return it.videoId
    ? {
        videoId: it.videoId,
        title: it.title,
        artist: it.artist,
        artistId: it.artistId,
        albumId: it.browseId,
        thumbs: it.thumbs,
      }
    : undefined;
}

/**
 * Wide editorial cards that snap one at a time and let the next one peek in.
 * Label, title and artist sit above the artwork; a dimmed caption strip with a
 * play affordance sits on it.
 */
export function FeaturedCarousel({ items }: { items: HomeItem[] }) {
  const p = usePlayer();
  const tracks = items.map(toTrack).filter(Boolean) as Track[];

  return (
    <section aria-label="Pilihan untukmu" className="mb-9">
      <div
        className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-1"
        style={{ marginRight: "calc(var(--pad-r) * -1)", paddingRight: "var(--pad-r)", scrollPaddingLeft: "8px" }}
      >
        {items.map((it, i) => {
          const track = toTrack(it);
          const href = it.browseId && it.kind === "album" ? `/album/${it.browseId}` : null;
          const isCurrent = !!track && p.current?.videoId === track.videoId;
          const playing = isCurrent && p.playing;
          const label = it.kind === "album" ? "Album" : "Lagu";
          const body = (
            <>
              <p className="t-eyebrow !text-label3">{label}</p>
              <h3 className="mt-1.5 truncate text-[20px] font-semibold leading-tight tracking-[-0.015em] text-label1">
                {it.title}
              </h3>
              <p className="truncate text-[20px] font-light leading-tight tracking-[-0.01em] text-label2">
                {it.artist ?? " "}
              </p>
              <div className="relative mt-3 aspect-[1.4] w-full overflow-hidden rounded-[12px] bg-fill1 shadow-[var(--shadow-art)] transition-transform duration-500 ease-[var(--ease-spring)] group-active:scale-[0.98]">
                <Artwork src={it.thumbs} eager={i < 2} />
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/35 px-3.5 py-2.5 text-white backdrop-blur-xl">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug">
                    {it.kind === "album" ? "Dengarkan albumnya sekarang" : "Putar lagu ini sekarang"}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25">
                    {playing ? <IconPause className="h-3.5 w-3.5" /> : <IconPlay className="ml-0.5 h-3.5 w-3.5" />}
                  </span>
                </div>
              </div>
            </>
          );
          const cls = "block w-full text-left";
          return (
            <div
              key={`${it.videoId ?? it.browseId}-${i}`}
              className="card-anim group w-[calc(100%-40px)] shrink-0 snap-start sm:w-[400px] lg:w-[440px]"
              style={{ "--i": i } as React.CSSProperties}
            >
              {href ? (
                <Link href={href} className={cls} aria-label={`${it.title}, ${it.artist ?? label}`}>
                  {body}
                </Link>
              ) : (
                <button
                  className={cls}
                  onClick={() => track && (isCurrent ? p.toggle() : p.playOne(track, tracks))}
                  aria-label={`${playing ? "Jeda" : "Putar"} ${it.title}`}
                >
                  {body}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SongRow({ it, queue }: { it: HomeItem; queue: Track[] }) {
  const p = usePlayer();
  const track = toTrack(it);
  const [ctx, setCtx] = useState<MenuAnchor | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const isCurrent = !!track && p.current?.videoId === track.videoId;
  const playing = isCurrent && p.playing;
  const href = !track && it.browseId ? `/album/${it.browseId}` : null;

  const main = (
    <>
      <span className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[8px] bg-fill1">
        <Artwork src={it.thumbs} />
        {playing && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white" aria-hidden="true">
            <span className="eq on"><span /><span /><span /></span>
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[16px] leading-tight ${isCurrent ? "text-accent" : "text-label1"}`}>
          {it.title}
        </span>
        <span className="mt-0.5 block truncate text-[15px] leading-tight text-label2">{it.artist}</span>
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-1 items-center gap-3 py-2 text-left";

  return (
    <div
      className="flex items-center gap-1 [&:not(:last-child)>*:first-child]:shadow-none"
      onContextMenu={(e) => {
        if (!track) return;
        e.preventDefault();
        setCtx({ x: e.clientX, y: e.clientY });
      }}
    >
      {href ? (
        <Link href={href} className={cls}>{main}</Link>
      ) : (
        <button className={cls} onClick={() => track && (isCurrent ? p.toggle() : p.playOne(track, queue))} aria-label={`${playing ? "Jeda" : "Putar"} ${it.title}, ${it.artist ?? ""}`}>
          {main}
        </button>
      )}
      {track && (
        <button
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setCtx({ x: r.right, y: r.bottom + 4, end: true });
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-label3 active:bg-fill2 hover:text-label1"
          aria-haspopup="menu"
          aria-label={`Aksi untuk ${it.title}`}
        >
          <IconEllipsis className="h-[18px] w-[18px]" />
        </button>
      )}
      {ctx && track && (
        <TrackMenu track={track} anchor={ctx} onClose={() => setCtx(null)} onAddToPlaylist={() => setAddOpen(true)} />
      )}
      {addOpen && track && <AddToPlaylistMenu track={track} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

/** A list laid out in pages of three rows; the next page peeks in from the right. */
export function SongColumns({ title, items }: { title: string; items: HomeItem[] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const queue = items.map(toTrack).filter(Boolean) as Track[];
  const cols: HomeItem[][] = [];
  for (let i = 0; i < items.length; i += 3) cols.push(items.slice(i, i + 3));

  const next = () => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section aria-label={title} className="mb-9">
      <button onClick={next} className="mb-1 flex items-center gap-1 text-left" aria-label={`${title}: lihat berikutnya`}>
        <h2 className="t-title text-label1">{title}</h2>
        <IconChevronRight className="mt-0.5 h-[18px] w-[18px] text-label3" />
      </button>
      <div
        ref={scroller}
        className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2"
        style={{ marginRight: "calc(var(--pad-r) * -1)", paddingRight: "var(--pad-r)", scrollPaddingLeft: "8px" }}
      >
        {cols.map((col, ci) => (
          <div key={ci} className="w-[calc(100%-40px)] shrink-0 snap-start divide-y divide-[var(--hairline)] sm:w-[400px] lg:w-[440px] [&>*]:pl-0">
            {col.map((it, i) => (
              <SongRow key={`${it.videoId ?? it.browseId}-${ci}-${i}`} it={it} queue={queue} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
