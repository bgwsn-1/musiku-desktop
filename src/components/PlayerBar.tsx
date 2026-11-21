"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/player";
import {
  IconEllipsis,
  IconLyrics,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconVolume,
  IconVolumeMute,
} from "@/components/Icons";
import { Scrubber } from "@/components/Scrubber";
import { NowPlaying } from "@/components/NowPlaying";
import { DesktopNowPlaying } from "@/components/DesktopNowPlaying";
import { Artwork } from "@/components/Artwork";
import { SearchForm } from "@/components/SearchForm";
import { ShortcutHelpDialog } from "@/components/ShortcutHelpDialog";
import { TrackMenu, type MenuAnchor } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";

const dockBtn =
  "flex shrink-0 items-center justify-center rounded-full text-label2 transition-[background-color,color,transform] duration-200 hover:bg-white/10 hover:text-label1 active:scale-90 disabled:opacity-40";

export function PlayerBar() {
  const p = usePlayer();
  const t = p.current;
  const [full, setFull] = useState(false);
  const [help, setHelp] = useState(false);
  const [ctx, setCtx] = useState<MenuAnchor | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Pintasan keyboard global. Dilewati kalau user sedang mengetik, menu
  // terbuka, atau dialog terbuka. Tombolnya bisa punya makna sendiri di sana.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input,textarea,select,[contenteditable],[role=menu]")) return;
      // Scrubber/slider punya handler panahnya sendiri (5 / 15 detik).
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && el?.closest("[role=slider]")) return;
      const inDialog = !!el?.closest("[role=dialog]");

      // Spasi = putar/jeda. Jangan telan kalau fokus sedang di elemen
      // yang memakai Spasi sendiri (tombol, tautan, slider).
      if (e.code === "Space") {
        if (e.repeat) return;
        if (inDialog || el?.closest("button,a,[role=slider]")) return;
        if (!p.current) return;
        e.preventDefault();
        p.toggle();
        return;
      }

      // Panah repeat iya boleh (naturnya buat scrub); yang lain tidak.
      const seeking =
        !e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !!p.current;
      if (e.repeat && !seeking) return;

      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      const seekBy = (delta: number) =>
        p.seek(
          delta > 0
            ? Math.min(p.position + delta, p.duration || p.position)
            : Math.max(p.position + delta, 0),
        );
      switch (e.key) {
        case "ArrowRight":
          if (e.shiftKey) {
            if (!inDialog && p.current) run(p.next);
          } else if (!inDialog && p.current) run(() => seekBy(5));
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            if (!inDialog && p.current) run(p.prev);
          } else if (!inDialog && p.current) run(() => seekBy(-5));
          break;
        case "f":
        case "F":
          if (!inDialog && p.current) run(() => setFull((v) => !v));
          break;
        case "m":
        case "M":
          if (!inDialog) run(p.toggleMute);
          break;
        case "l":
        case "L":
          if (!inDialog && p.current) run(() => p.toggleLike(p.current!));
          break;
        case "q":
        case "Q":
          if (!inDialog) run(() => p.toggleUi("queue"));
          break;
        case "y":
        case "Y":
          if (!inDialog) run(() => p.toggleUi("lyrics"));
          break;
        case "s":
        case "S":
          if (!inDialog) run(p.toggleShuffle);
          break;
        case "r":
        case "R":
          if (!inDialog) run(p.cycleRepeat);
          break;
        case "?":
          if (!inDialog && !full) {
            e.preventDefault();
            setHelp((v) => !v);
          }
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [p, full]);

  const phonePlayBtn = (size: string, icon: string) => (
    <button
      onClick={p.toggle}
      disabled={!t}
      className={`flex shrink-0 items-center justify-center rounded-full bg-label1 text-window hover:opacity-85 disabled:opacity-40 ${size}`}
      aria-label={p.playing ? "Jeda" : "Putar"}
    >
      {p.resolving ? (
        <svg viewBox="0 0 24 24" className={`spin ${icon}`} fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0110 10h-2a8 8 0 00-8-8V2z" />
        </svg>
      ) : p.playing ? (
        <span key="playing" className="anim-pop inline-flex">
          <IconPause className={icon} />
        </span>
      ) : (
        <span key="paused" className="anim-pop inline-flex">
          <IconPlay className={`${icon} translate-x-px`} />
        </span>
      )}
    </button>
  );

  const dockPlayBtn = () => (
    <button
      onClick={p.toggle}
      disabled={!t}
      className={`${dockBtn} h-12 w-12 text-label1`}
      aria-label={p.playing ? "Jeda" : "Putar"}
    >
      {p.resolving ? (
        <svg viewBox="0 0 24 24" className="spin h-6 w-6" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0110 10h-2a8 8 0 00-8-8V2z" />
        </svg>
      ) : (
        <span key={p.playing ? "playing" : "paused"} className="anim-pop inline-flex">
          {p.playing ? <IconPause className="h-6 w-6" /> : <IconPlay className="h-6 w-6 translate-x-px" />}
        </span>
      )}
    </button>
  );

  const art = <Artwork src={t?.thumbs} />;

  return (
    <>
      <NowPlaying open={full && !!t} onClose={() => setFull(false)} />
      <DesktopNowPlaying open={full && !!t} onClose={() => setFull(false)} />
      <ShortcutHelpDialog open={help} onClose={() => setHelp(false)} />
      {/* ── Phone: belum ada lagu → kolom cari duduk di atas tab bar. Begitu
             ada lagu, mini player ambil tempat itu dan kolom cari naik ke
             toolbar paling atas (lihat TopBar). ── */}
      {!t && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+78px)] z-40 lg:hidden">
          <SearchForm variant="dock" />
        </div>
      )}
      {/* ── Phone: mini player di atas tab bar ── */}
      {t && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+78px)] z-40 lg:hidden">
          <section
            className="dock-in glass relative flex h-[64px] items-center gap-3 rounded-[26px] pl-2.5 pr-2"
            aria-label="Pemutar mini"
          >
            <button
              onClick={() => setFull(true)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label={`${t.title}${t.artist ? `, ${t.artist}` : ""}. Buka pemutar`}
            >
              <span className={`block h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-fill2 shadow-[var(--shadow-art)] transition-transform duration-500 ease-[var(--ease-spring)] ${p.playing ? "scale-100" : "scale-[0.9]"}`}>
                {art}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold leading-tight text-label1">
                  {t.title}
                </span>
                <span className="block truncate text-[13px] leading-tight text-label2">
                  {t.artist}
                </span>
              </span>
            </button>
            {phonePlayBtn("h-11 w-11", "h-5 w-5")}
            <button
              onClick={p.next}
              className="glass-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label1"
              aria-label="Lagu berikutnya"
            >
              <IconNext className="h-5 w-5" />
            </button>
            <Scrubber
              position={p.position}
              duration={p.duration || 0}
              onSeek={p.seek}
              thin
              className="absolute inset-x-5 -bottom-0.5"
            />
          </section>
        </div>
      )}

      {/* ── Desktop: floating spatial bottom bar dari referensi Figma ── */}
      {t && (
        <div className="pointer-events-none absolute bottom-4 left-[var(--pad-l)] right-[var(--pad-r)] z-40 hidden lg:block">
          <section
            className="dock-in player-dock pointer-events-auto glass relative mx-auto flex h-[76px] w-full max-w-[767px] items-center gap-[24px] rounded-[38px] px-[20px]"
            aria-label="Kontrol pemutar"
          >
            <div className="flex shrink-0 items-center gap-[16px]">
              <button onClick={p.prev} className={`${dockBtn} h-12 w-12`} aria-label="Lagu sebelumnya">
                <IconPrev className="h-6 w-6" />
              </button>
              {dockPlayBtn()}
              <button onClick={p.next} className={`${dockBtn} h-12 w-12`} aria-label="Lagu berikutnya">
                <IconNext className="h-6 w-6" />
              </button>
            </div>

            <div className="relative flex h-[58px] min-w-0 flex-1 items-center gap-3 rounded-[10px] bg-white/10 pl-1.5 pr-2.5">
              <button
                onClick={() => setFull(true)}
                className="block h-11 w-11 shrink-0 overflow-hidden rounded-[6px] bg-fill2 shadow-[var(--shadow-art)]"
                aria-label="Buka pemutar layar penuh"
                title="Pemutar layar penuh (F)"
              >
                {art}
              </button>
              <button
                onClick={() => setFull(true)}
                className="min-w-0 flex-1 text-left"
                aria-label={`${t.title}${t.artist ? `, ${t.artist}` : ""}. Buka pemutar`}
              >
                <span className="block truncate text-[16px] leading-tight text-label1">{t.title}</span>
                <span className="block truncate text-[14px] leading-tight text-label2">{t.artist}</span>
              </button>
              <button
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setCtx({ x: r.left, y: r.bottom + 4 });
                }}
                className={`${dockBtn} h-8 w-8`}
                aria-label="Opsi lagu"
                aria-haspopup="menu"
              >
                <IconEllipsis className="h-5 w-5" />
              </button>
              <Scrubber
                hairline
                position={p.position}
                duration={p.duration || 0}
                onSeek={p.seek}
                className="absolute inset-x-3 bottom-0.5 !h-3"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => p.toggleUi("lyrics")}
                className={`${dockBtn} h-10 w-10 ${p.ui === "lyrics" ? "!text-accent" : ""}`}
                aria-pressed={p.ui === "lyrics"}
                aria-label="Lirik"
              >
                <IconLyrics className="h-5 w-5" />
              </button>
              <button
                onClick={() => p.toggleUi("queue")}
                className={`${dockBtn} h-10 w-10 ${p.ui === "queue" ? "!text-accent" : ""}`}
                aria-pressed={p.ui === "queue"}
                aria-label="Antrian"
              >
                <IconQueue className="h-5 w-5" />
              </button>
              <button onClick={p.toggleMute} className={`${dockBtn} h-10 w-10`} aria-label={p.muted ? "Suarakan" : "Bisukan"}>
                {p.muted || p.volume === 0 ? (
                  <IconVolumeMute className="h-5 w-5" />
                ) : (
                  <IconVolume className="h-5 w-5" />
                )}
              </button>
            </div>
          </section>
          {ctx && (
            <TrackMenu
              track={t}
              anchor={ctx}
              onClose={() => setCtx(null)}
              onAddToPlaylist={() => setAddOpen(true)}
            />
          )}
          {addOpen && <AddToPlaylistMenu track={t} onClose={() => setAddOpen(false)} />}
        </div>
      )}
    </>
  );
}
