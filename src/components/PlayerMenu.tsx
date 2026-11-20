"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { IconChevronRight } from "@/components/Icons";

type Props = {
  track: Track;
  liked: boolean;
  sleepLabel: string | null;
  crossfade: boolean;
  cfSec: number;
  onCrossfade: () => void;
  onCfSec: (n: number) => void;
  onClose: () => void;
  onShare: () => void;
  onPlayNext: () => void;
  onQueue: () => void;
  onLike: () => void;
  onPlaylist: () => void;
  onAlbum?: () => void;
  onArtist?: () => void;
  onInfo: () => void;
  onSleep: (minutes: number | null) => void;
};

const ic = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const I = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-[23px] w-[23px] shrink-0" {...ic} aria-hidden="true">
    {children}
  </svg>
);
const Share = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" {...ic} aria-hidden="true">
    <path d="M12 15V3.5M8 7l4-4 4 4M6.5 10.5H6A2 2 0 004 12.5v6A2 2 0 006 20.5h12a2 2 0 002-2v-6a2 2 0 00-2-2h-.5" />
  </svg>
);
const Next = () => (
  <I>
    <path d="M3.5 6h3M3.5 12h17M3.5 18h17M10 6h10.5" />
    <path d="M4 3.5l2.6 2.5L4 8.5" />
  </I>
);
const Queue = () => (
  <I>
    <path d="M3.5 6h17M3.5 12h17M3.5 18h8" />
    <path d="M17 15.5v5M14.5 18h5" />
  </I>
);
const Heart = ({ on }: { on: boolean }) => (
  <I>
    <path
      d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"
      fill={on ? "currentColor" : "none"}
    />
  </I>
);
const Plus = () => (
  <I>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </I>
);
const Album = () => (
  <I>
    <rect x="7" y="8.5" width="10" height="12" rx="1.6" />
    <path d="M8.5 5.5h7M9.8 3h4.4" />
  </I>
);
const Mic = () => (
  <I>
    <path d="M14.2 4.3a3.3 3.3 0 014.7 4.7l-5.4 5.4-4.7-4.7 5.4-5.4zM9.2 13.3l-5.4 6.9M7.5 10.3l6.2 6.2" />
  </I>
);
const Info = () => (
  <I>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6v.1" />
  </I>
);
const Moon = () => (
  <I>
    <path d="M19.5 14.2A7.8 7.8 0 019.8 4.5a8 8 0 109.7 9.7z" />
    <path d="M15 3h4l-4 4.2h4" strokeWidth={1.4} />
  </I>
);
const Cross = () => (
  <I>
    <circle cx="9" cy="12" r="5.5" />
    <circle cx="15" cy="12" r="5.5" />
  </I>
);
const Back = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" {...ic} aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

const row =
  "flex w-full min-h-[48px] items-center gap-4 px-5 py-1.5 text-left text-[17px] leading-tight text-white active:bg-white/10";
const sep = <div className="mx-4 my-1 h-px bg-white/15" role="separator" />;

/** Floating action panel for the phone player, anchored bottom-right like a popover. */
export function PlayerMenu(p: Props) {
  const [view, setView] = useState<"main" | "sleep" | "crossfade">("main");
  const [closing, setClosing] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const { onClose } = p;

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 160);
  };
  const run = (fn?: () => void) => () => {
    fn?.();
    close();
  };

  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="absolute inset-0 z-20">
      <button className="absolute inset-0 cursor-default" onClick={close} aria-label="Tutup menu" tabIndex={-1} />
      <div
        ref={box}
        role="menu"
        aria-label={`Opsi untuk ${p.track.title}`}
        className={`${closing ? "pmenu-out" : "pmenu-in"} absolute bottom-[calc(env(safe-area-inset-bottom)+28px)] right-4 max-h-[calc(100dvh-96px)] w-[min(268px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-[rgba(30,30,33,0.86)] py-2 shadow-[0_24px_60px_-8px_rgba(0,0,0,0.75)] backdrop-blur-2xl backdrop-saturate-150`}
      >
        {view === "main" ? (
          <>
            <button role="menuitem" onClick={run(p.onShare)} className="flex w-full flex-col items-center gap-1.5 pb-3 pt-4 text-white active:bg-white/10">
              <Share />
              <span className="text-[14px]">Bagikan</span>
            </button>
            {sep}
            <button role="menuitem" className={row} onClick={run(p.onPlayNext)}>
              <Next /> Putar berikutnya
            </button>
            <button role="menuitem" className={row} onClick={run(p.onQueue)}>
              <Queue /> Tambah ke antrian
            </button>
            {sep}
            <button role="menuitem" className={row} onClick={run(p.onLike)}>
              <Heart on={p.liked} /> {p.liked ? "Hapus dari favorit" : "Tambah ke favorit"}
            </button>
            <button role="menuitem" className={row} onClick={run(p.onPlaylist)}>
              <Plus /> Tambah ke playlist…
            </button>
            {sep}
            {p.onAlbum && (
              <button role="menuitem" className={row} onClick={run(p.onAlbum)}>
                <Album />
                <span className="min-w-0">
                  Buka album
                  {p.track.album && <span className="block truncate text-[15px] text-white/55">{p.track.album}</span>}
                </span>
              </button>
            )}
            {p.onArtist && (
              <button role="menuitem" className={row} onClick={run(p.onArtist)}>
                <Mic />
                <span className="min-w-0">
                  Buka artis
                  {p.track.artist && <span className="block truncate text-[15px] text-white/55">{p.track.artist}</span>}
                </span>
              </button>
            )}
            <button role="menuitem" className={row} onClick={run(p.onInfo)}>
              <Info /> Info lagu
            </button>
            {sep}
            <button role="menuitem" className={row} onClick={() => setView("sleep")}>
              <Moon />
              <span className="min-w-0 flex-1">
                Pewaktu tidur
                {p.sleepLabel && <span className="block truncate text-[15px] text-white/55">{p.sleepLabel}</span>}
              </span>
              <IconChevronRight className="h-4 w-4 text-white/40" />
            </button>
            <button role="menuitem" className={row} onClick={run(p.onCrossfade)} aria-checked={p.crossfade}>
              <Cross />
              <span className="min-w-0 flex-1">
                Crossfade
                <span className="block truncate text-[15px] text-white/55">
                  {p.crossfade ? `Aktif · ${p.cfSec} detik` : "Mati"}
                </span>
              </span>
            </button>
            {p.crossfade && (
              <button
                role="menuitem"
                className={row}
                onClick={() => setView("crossfade")}
                aria-haspopup="menu"
              >
                <span className="w-5" aria-hidden="true" />
                <span className="min-w-0 flex-1">Durasi crossfade</span>
                <IconChevronRight className="h-4 w-4 text-white/40" />
              </button>
            )}
          </>
        ) : view === "sleep" ? (
          <>
            <button role="menuitem" className="flex w-full items-center gap-2 px-4 pb-2 pt-3 text-left text-[17px] font-semibold text-white active:bg-white/10" onClick={() => setView("main")}>
              <Back /> Pewaktu tidur
            </button>
            {sep}
            {[15, 30, 45, 60].map((m) => (
              <button key={m} role="menuitem" className={row} onClick={run(() => p.onSleep(m))}>
                {m} menit
              </button>
            ))}
            {p.sleepLabel && (
              <>
                {sep}
                <button role="menuitem" className={`${row} !text-[#ff6b7d]`} onClick={run(() => p.onSleep(null))}>
                  Matikan pewaktu
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button role="menuitem" className="flex w-full items-center gap-2 px-4 pb-2 pt-3 text-left text-[17px] font-semibold text-white active:bg-white/10" onClick={() => setView("main")}>
              <Back /> Crossfade
            </button>
            {sep}
            {[2, 4, 6, 8, 10, 12].map((n) => (
              <button
                key={n}
                role="menuitemradio"
                aria-checked={p.cfSec === n}
                className={row}
                onClick={run(() => p.onCfSec(n))}
              >
                <span className="min-w-0 flex-1">{n} detik</span>
                {p.cfSec === n && (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#fa586a]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
