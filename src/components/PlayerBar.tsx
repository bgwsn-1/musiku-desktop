"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/player";
import {
  IconExpand,
  IconHeart,
  IconKeyboard,
  IconLyrics,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconVolume,
  IconVolumeMute,
} from "@/components/Icons";
import fmtTime from "@/lib/timefmt";
import { Scrubber } from "@/components/Scrubber";
import { NowPlaying } from "@/components/NowPlaying";
import { DesktopNowPlaying } from "@/components/DesktopNowPlaying";
import { Artwork } from "@/components/Artwork";
import { Dialog } from "@/components/Dialog";
import { SearchForm } from "@/components/SearchForm";

const iconBtn =
  "glass-btn flex h-10 w-10 items-center justify-center rounded-full text-label2 hover:text-label1";
const iconBtnSm =
  "glass-btn flex h-8 w-8 items-center justify-center rounded-full text-label2 hover:text-label1";

export function PlayerBar() {
  const p = usePlayer();
  const t = p.current;
  const liked = t ? p.isLiked(t.videoId) : false;
  const [pop, setPop] = useState(false);
  const [full, setFull] = useState(false);
  const [help, setHelp] = useState(false);

  // Pintasan keyboard global. Dilewati kalau user sedang mengetik, menu
  // terbuka, atau dialog terbuka — tombolnya bisa punya makna sendiri di sana.
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
          if (!inDialog) {
            e.preventDefault();
            setHelp((v) => !v);
          }
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [p]);

  const playBtn = (size: string, icon: string) => (
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
            {playBtn("h-11 w-11", "h-5 w-5")}
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

      {/* ── Desktop: floating glass pill (only once something plays) ── */}
      {t && (
        <div className="pointer-events-none absolute bottom-4 left-[var(--pad-l)] right-[var(--pad-r)] z-40 hidden lg:block">
          <section
            className="dock-in player-dock pointer-events-auto glass relative mx-auto flex h-[78px] max-w-[1000px] items-center gap-3 rounded-full px-3.5"
            aria-label="Kontrol pemutar"
          >
            {/* kiri: transport */}
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={p.toggleShuffle}
                className={`${iconBtnSm} ${p.shuffle ? "!text-accent" : ""}`}
                aria-pressed={p.shuffle}
                aria-label="Acak"
              >
                <IconShuffle className="h-4 w-4" />
              </button>
              <button onClick={p.prev} disabled={!t} className={iconBtn} aria-label="Lagu sebelumnya">
                <IconPrev className="h-5 w-5" />
              </button>
              {playBtn("mx-0.5 h-11 w-11", "h-5 w-5")}
              <button onClick={p.next} disabled={!t} className={iconBtn} aria-label="Lagu berikutnya">
                <IconNext className="h-5 w-5" />
              </button>
              <button
                onClick={p.cycleRepeat}
                className={`${iconBtnSm} ${p.repeat !== "off" ? "!text-accent" : ""}`}
                aria-pressed={p.repeat !== "off"}
                aria-label={`Ulangi: ${p.repeat === "off" ? "mati" : p.repeat === "all" ? "semua" : "satu lagu"}`}
              >
                {p.repeat === "one" ? (
                  <IconRepeatOne className="h-4 w-4" />
                ) : (
                  <IconRepeat className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* tengah: now playing + progress tipis */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                onClick={() => setFull(true)}
                className={`block h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[17px] bg-fill2 shadow-[var(--shadow-art)] transition-transform duration-500 ease-[var(--ease-spring)] ${p.playing ? "scale-100" : "scale-[0.92]"}`}
                aria-label="Buka pemutar layar penuh"
                title="Pemutar layar penuh (F)"
              >
                {art}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold leading-tight text-label1">
                  {t.title}
                </div>
                <div className="truncate text-[12px] leading-tight text-label2">
                  {t.artist}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-label3 tnum">
                  <span className="w-8 text-right">{fmtTime(p.position)}</span>
                  <Scrubber
                    position={p.position}
                    duration={p.duration || 0}
                    onSeek={p.seek}
                    thin
                    className="flex-1"
                  />
                  <span className="w-8">{fmtTime(p.duration)}</span>
                </div>
              </div>
            </div>

            {/* kanan: panel + volume */}
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => {
                  if (!liked) {
                    setPop(true);
                    setTimeout(() => setPop(false), 600);
                  }
                  p.toggleLike(t);
                }}
                className={`${iconBtnSm} ${
                  liked ? "!text-accent" : ""
                } ${pop ? "heart-pop" : ""}`}
                aria-label={liked ? "Hapus dari favorit" : "Tambahkan ke favorit"}
                aria-pressed={liked}
              >
                <IconHeart filled={liked} className="h-[17px] w-[17px]" />
              </button>
              <button
                onClick={() => p.toggleUi("lyrics")}
                className={`${iconBtn} ${p.ui === "lyrics" ? "!bg-fill2 !text-label1" : ""}`}
                aria-pressed={p.ui === "lyrics"}
                aria-label="Lirik"
              >
                <IconLyrics className="h-5 w-5" />
              </button>
              <button
                onClick={() => p.toggleUi("queue")}
                className={`${iconBtn} ${p.ui === "queue" ? "!bg-fill2 !text-label1" : ""}`}
                aria-pressed={p.ui === "queue"}
                aria-label="Antrian"
              >
                <IconQueue className="h-5 w-5" />
              </button>
              <button
                onClick={() => setFull(true)}
                disabled={!t}
                className={`${iconBtnSm} disabled:opacity-40`}
                aria-label="Buka pemutar layar penuh"
                title="Expand (F)"
              >
                <IconExpand className="h-4 w-4" />
              </button>
              <button
                onClick={() => setHelp(true)}
                className={iconBtnSm}
                aria-label="Pintasan keyboard"
                title="Pintasan keyboard (?)"
              >
                <IconKeyboard className="h-4 w-4" />
              </button>
              <button onClick={p.toggleMute} className={iconBtn} aria-label={p.muted ? "Suarakan" : "Bisukan"}>
                {p.muted || p.volume === 0 ? (
                  <IconVolumeMute className="h-5 w-5" />
                ) : (
                  <IconVolume className="h-5 w-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={p.muted ? 0 : p.volume}
                onChange={(e) => p.setVolume(Number(e.target.value))}
                className="appleslider ml-1 hidden w-14 xl:block"
                style={{ ["--fill" as string]: `${(p.muted ? 0 : p.volume) * 100}%` } as React.CSSProperties}
                aria-label="Volume"
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const kbd =
  "inline-flex min-w-[22px] items-center justify-center rounded-md bg-fill1 px-1.5 py-0.5 text-center text-[12px] font-semibold text-label1 shadow-[0_1px_0_rgba(255,255,255,0.06)]";

/** Daftar pintasan global — bisa dibuka lewat tombol ikon keyboard atau tombol `?`. */
function ShortcutHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ["Spasi"], label: "Putar / jeda" },
    { keys: ["⇧", "→"], label: "Lagu berikutnya" },
    { keys: ["⇧", "←"], label: "Lagu sebelumnya" },
    { keys: ["→"], label: "Maju 5 detik" },
    { keys: ["←"], label: "Mundur 5 detik" },
    { keys: ["F"], label: "Layar penuh" },
    { keys: ["L"], label: "Favorit" },
    { keys: ["M"], label: "Bisukan suara" },
    { keys: ["Q"], label: "Antrian" },
    { keys: ["Y"], label: "Lirik" },
    { keys: ["S"], label: "Acak" },
    { keys: ["R"], label: "Ulangi" },
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Pintasan keyboard">
      <ul>
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] py-2 text-[14px] text-label2 last:border-b-0"
          >
            <span>{row.label}</span>
            <span className="flex shrink-0 gap-1">
              {row.keys.map((key, i) => (
                <kbd key={i} className={kbd}>
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-label3">
        Pintasan dilewati saat sedang mengetik atau saat dialog terbuka.
      </p>
    </Dialog>
  );
}

