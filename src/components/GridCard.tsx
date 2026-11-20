"use client";

import Link from "next/link";
import { Children, useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { IconBack, IconForward, IconPause, IconPlay } from "@/components/Icons";
import { Artwork } from "@/components/Artwork";
import type { Track } from "@/lib/types";

/**
 * Artwork-first card. The artwork is the hero; text sits below without a box.
 * A real <a> / <button> wraps the card, and the play control is its sibling,
 * never nested inside it.
 */
export function GridCard({
  title,
  subtitle,
  href,
  img,
  track,
  queue,
  round = false,
  i = 0,
}: {
  title: string;
  subtitle?: string | null;
  href?: string | null;
  img?: string | null;
  track?: Track;
  queue?: Track[];
  round?: boolean;
  i?: number;
}) {
  const p = usePlayer();
  const isCurrent = !!(track && p.current?.videoId === track.videoId);
  const playing = isCurrent && p.playing;

  const act = () => (isCurrent ? p.toggle() : track && p.playOne(track, queue));

  const inner = (
    <>
      <div
        className={`relative mb-3 aspect-square w-full overflow-hidden bg-fill1 shadow-[var(--shadow-art)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-spring)] group-active:scale-[0.97] [@media(hover:hover)]:group-hover:-translate-y-1 [@media(hover:hover)]:group-hover:shadow-[0_18px_36px_-12px_rgba(0,0,0,0.5)] ${
          round ? "rounded-full" : "rounded-[14px]"
        }`}
      >
        <Artwork
          src={img}
          className="h-full w-full object-cover transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.04]"
        />
        {/* no separate button when the whole card already plays */}
        {!href && track && (
          <span
            aria-hidden="true"
            className={`glass-clear absolute bottom-2.5 left-2.5 flex h-10 w-10 items-center justify-center rounded-full transition-opacity ${
              playing ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            }`}
          >
            {playing ? <IconPause className="h-4 w-4" /> : <IconPlay className="ml-0.5 h-4 w-4" />}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {playing && (
          <span className="eq on shrink-0 text-accent" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        )}
        <span
          className={`truncate text-[15px] font-semibold leading-tight ${
            isCurrent ? "text-accent" : "text-label1"
          }`}
        >
          {title}
        </span>
      </div>
      {subtitle && <div className="mt-0.5 truncate text-[13px] leading-tight text-label2">{subtitle}</div>}
    </>
  );

  return (
    <div className="card-anim group relative" style={{ "--i": i } as React.CSSProperties}>
      {href ? (
        <Link href={href} aria-label={subtitle ? `${title}, ${subtitle}` : title} className="block rounded-[14px]">
          {inner}
        </Link>
      ) : track ? (
        <button
          onClick={act}
          aria-label={`${playing ? "Jeda" : "Putar"} ${title}${subtitle ? `, ${subtitle}` : ""}`}
          className="block w-full rounded-[14px] text-left"
        >
          {inner}
        </button>
      ) : (
        <div>{inner}</div>
      )}

      {href && track && (
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
          <button
            onClick={act}
            className={`glass-clear pointer-events-auto absolute bottom-2.5 left-2.5 flex h-10 w-10 items-center justify-center rounded-full transition-[opacity,transform] hover:scale-105 ${
              playing
                ? "opacity-100"
                : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            }`}
            aria-label={`${playing ? "Jeda" : "Putar"} ${title}`}
          >
            {playing ? <IconPause className="h-4 w-4" /> : <IconPlay className="ml-0.5 h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A titled shelf. "row" scrolls sideways with snap and bleeds off the right
 * edge (arrows for mouse users); "grid" wraps — used for search results.
 */
export function Shelf({
  title,
  children,
  action,
  layout = "row",
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  layout?: "row" | "grid";
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [can, setCan] = useState({ l: false, r: false });

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCan({
      l: el.scrollLeft > 4,
      r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (layout !== "row" || !el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [layout, update, children]);

  const by = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const arrow =
    "flex h-8 w-8 items-center justify-center rounded-full bg-fill1 text-label1 hover:bg-fill2 disabled:pointer-events-none disabled:opacity-30";

  return (
    <section className="mb-10" aria-label={title || undefined}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="t-title text-label1">{title}</h2> : <span />}
          <div className="flex items-center gap-2">
            {action}
            {layout === "row" && (
              <div className="hidden gap-1.5 lg:flex [@media(hover:none)]:hidden">
                <button className={arrow} onClick={() => by(-1)} disabled={!can.l} aria-label={`${title || "Rak"}: geser kiri`}>
                  <IconBack className="h-4 w-4" />
                </button>
                <button className={arrow} onClick={() => by(1)} disabled={!can.r} aria-label={`${title || "Rak"}: geser kanan`}>
                  <IconForward className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {layout === "row" ? (
        <div
          ref={scroller}
          className="no-scrollbar -mx-2 -mt-1 flex snap-x snap-proximity gap-4 overflow-x-auto px-2 pb-3 pt-1"
          style={{ marginRight: "calc(var(--pad-r) * -1)", paddingRight: "var(--pad-r)" }}
        >
          {Children.toArray(children).map((c, k) => (
            <div key={k} className="w-[148px] shrink-0 snap-start sm:w-[164px] xl:w-[184px]">
              {c}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 min-[40rem]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {children}
        </div>
      )}
    </section>
  );
}
