"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import {
  IconClose,
  IconCrossfade,
  IconEllipsis,
  IconHeart,
  IconLyrics,
  IconPause,
  IconPlay,
  IconPrev,
  IconNext,
  IconRepeat,
  IconRepeatOne,
  IconShare,
  IconShuffle,
  IconVolume,
  IconVolumeMute,
} from "@/components/Icons";
import { Scrubber } from "@/components/Scrubber";
import { Artwork } from "@/components/Artwork";
import { shareTrack } from "@/components/ShareCard";
import { LyricsPanel } from "@/components/LyricsPanel";
import { ImmersiveLyrics } from "@/components/ImmersiveLyrics";
import { QueuePanel } from "@/components/QueuePanel";
import { toast } from "@/components/Toast";
import { TrackMenu, type MenuAnchor } from "@/components/TrackMenu";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import fmtTime from "@/lib/timefmt";

/**
 * Layar penuh "Sedang diputar" untuk desktop — pasangan dari NowPlaying (HP).
 * Artwork jadi poster di kiri; lirik / antrian di kanan. Selalu gelap, warna
 * dari artwork (force-dark). Esc atau tombol tutup untuk keluar.
 */
export function DesktopNowPlaying({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const p = usePlayer();
  const t = p.current;
  const [tab, setTab] = useState<"lyrics" | "queue">("lyrics");
  const [pop, setPop] = useState(false);
  const [ctx, setCtx] = useState<MenuAnchor | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [desktopClient, setDesktopClient] = useState(false);
  const closeBtn = useRef<HTMLButtonElement | null>(null);

  // Tauri menyuntik `__TAURI_INTERNALS__`; browser biasa (web/Android) tidak.
  useEffect(() => {
    setDesktopClient(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
  }, []);

  // lagu habis → lamanenya gak nyangka, tutup
  useEffect(() => {
    if (!open) setImmersive(false);
    if (open && !t) onClose();
  }, [open, t, onClose]);

  useEffect(() => {
    if (!open || immersive) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog],[role=menu]")) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, immersive]);

  if (!open || !t) return null;
  if (immersive && desktopClient) {
    return <ImmersiveLyrics onExit={() => setImmersive(false)} />;
  }
  const liked = p.isLiked(t.videoId);
  const remaining = Math.max(0, (p.duration || 0) - p.position);

  const round =
    "flex items-center justify-center rounded-full transition-[background-color,transform,opacity] duration-200 active:scale-90";
  const tool = (on: boolean) =>
    `${round} h-10 w-10 ${on ? "bg-fill2 text-label1" : "text-label2 hover:text-label1"}`;

  return (
    <div
      role="region"
      aria-label="Sedang diputar"
      className="force-dark dialog-in fixed inset-0 z-[68] hidden overflow-hidden bg-window lg:flex"
    >
      {/* warna artwork memenuhi layar */}
      <div className="np-backdrop" aria-hidden="true">
        <Artwork key={t.videoId} src={t.thumbs} quiet />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col p-8 xl:p-10">
        <div className="flex shrink-0 items-center justify-end gap-2">
          {desktopClient && (
            <button
              onClick={() => setImmersive(true)}
              className={`${round} h-11 w-11 text-label2 hover:text-label1`}
              aria-label="Aktifkan mode lirik imersif"
              title="Mode lirik imersif"
            >
              <IconLyrics className="h-5 w-5" />
            </button>
          )}
          <button
            ref={closeBtn}
            onClick={onClose}
            className={`${round} h-11 w-11 text-label2 hover:text-label1`}
            aria-label="Tutup pemutar"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10">
          {/* kolom kiri: artwork + kontrol */}
          <div className="flex min-w-0 flex-col items-center justify-center gap-6">
            <div
              className="aspect-square w-full max-w-[min(46dvh,440px)] overflow-hidden rounded-[18px] bg-fill2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65)]"
              style={{ width: "min(100%, calc(100dvh - 300px))" }}
            >
              <Artwork src={t.thumbs} alt={`Sampul ${t.title}`} />
            </div>

            <div className="flex w-full items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  {t.title}
                </h2>
                {t.artist && (
                  <p className="truncate text-[19px] leading-tight text-label2">{t.artist}</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (!liked) {
                    setPop(true);
                    setTimeout(() => setPop(false), 600);
                  }
                  p.toggleLike(t);
                }}
                className={`${mini} ${liked ? "!text-accent" : ""} ${pop ? "heart-pop" : ""}`}
                aria-label={liked ? "Hapus dari favorit" : "Tambahkan ke favorit"}
                aria-pressed={liked}
              >
                <IconHeart filled={liked} className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={() => void shareTrack(t, p.duration ? p.position / p.duration : 0)}
                className={mini}
                aria-label="Bagikan kartu lagu"
              >
                <IconShare className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setCtx({ x: r.right, y: r.bottom + 4, end: true });
                }}
                className={mini}
                aria-haspopup="menu"
                aria-label="Opsi lainnya"
              >
                <IconEllipsis className="h-[18px] w-[18px]" />
              </button>
            </div>

            <Scrubber position={p.position} duration={p.duration || 0} onSeek={p.seek} className="w-full" />

            <div className="-mt-4 flex justify-between text-[12px] font-medium text-label2 tnum">
              <span>{fmtTime(p.position)}</span>
              <span>{p.duration ? `-${fmtTime(remaining)}` : "--:--"}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  p.toggleCrossfade();
                  toast(p.crossfade ? "Crossfade dimatikan" : `Crossfade aktif — ${p.cfSec} detik`);
                }}
                className={tool(p.crossfade)}
                aria-pressed={p.crossfade}
                aria-label="Crossfade"
              >
                <IconCrossfade className="h-[20px] w-[20px]" />
              </button>
              {p.crossfade && (
                <button
                  onClick={p.cycleCfSec}
                  className="glass-btn h-10 min-w-10 rounded-full bg-fill2 px-2.5 text-[13px] font-semibold tnum text-label1 hover:text-accent transition-colors"
                  aria-label={`Durasi crossfade: ${p.cfSec} detik`}
                  title="Ubah durasi crossfade"
                >
                  {p.cfSec}s
                </button>
              )}
              <button onClick={p.toggleShuffle} className={tool(p.shuffle)} aria-pressed={p.shuffle} aria-label="Acak">
                <IconShuffle className="h-[20px] w-[20px]" />
              </button>
              <button onClick={p.prev} className={`${round} h-14 w-16 text-label1`} aria-label="Lagu sebelumnya">
                <IconPrev className="h-[24px] w-[24px]" />
              </button>
              {p.resolving ? (
                <div className={`${round} h-16 w-16 text-label1`} aria-label="Memuat">
                  <svg viewBox="0 0 24 24" className="spin h-8 w-8" fill="currentColor" aria-hidden="true">
                    <path d="M12 2a10 10 0 0110 10h-2a8 8 0 00-8-8V2z" />
                  </svg>
                </div>
              ) : (
                <button onClick={p.toggle} className={`${round} h-16 w-16 text-label1`} aria-label={p.playing ? "Jeda" : "Putar"}>
                  <span key={p.playing ? "p" : "s"} className="anim-pop inline-flex">
                    {p.playing ? <IconPause className="h-10 w-10" /> : <IconPlay className="h-10 w-10" />}
                  </span>
                </button>
              )}
              <button onClick={p.next} className={`${round} h-14 w-16 text-label1`} aria-label="Lagu berikutnya">
                <IconNext className="h-[24px] w-[24px]" />
              </button>
              <button
                onClick={p.cycleRepeat}
                className={tool(p.repeat !== "off")}
                aria-pressed={p.repeat !== "off"}
                aria-label={`Ulangi: ${p.repeat === "off" ? "mati" : p.repeat === "all" ? "semua" : "satu lagu"}`}
              >
                {p.repeat === "one" ? <IconRepeatOne className="h-[20px] w-[20px]" /> : <IconRepeat className="h-[20px] w-[20px]" />}
              </button>
            </div>

            <div className="flex w-full shrink-0 items-center gap-3 text-label2">
              <button
                onClick={p.toggleMute}
                className="flex h-10 w-6 items-center justify-center"
                aria-label={p.muted ? "Suarakan" : "Bisukan"}
              >
                {p.muted || p.volume === 0 ? <IconVolumeMute className="h-[18px] w-[18px]" /> : <IconVolume className="h-[18px] w-[18px]" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={p.muted ? 0 : p.volume}
                onChange={(e) => p.setVolume(Number(e.target.value))}
                className="appleslider min-w-0 flex-1"
                style={{ ["--fill" as string]: `${(p.muted ? 0 : p.volume) * 100}%` } as React.CSSProperties}
                aria-label="Volume"
              />
              <IconVolume className="h-[22px] w-[22px]" />
            </div>
          </div>

          {/* kolom kanan: lirik / antrian */}
          <div className="flex min-h-0 flex-col">
            <div
              className="mb-4 inline-flex shrink-0 self-start gap-1 rounded-full bg-fill1 p-1"
              role="tablist"
              aria-label="Panel pemutar"
            >
              {(["lyrics", "queue"] as const).map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`h-9 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                    tab === k
                      ? "bg-[var(--seg-thumb)] text-label1 shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                      : "text-label2 hover:text-label1"
                  }`}
                >
                  {k === "lyrics" ? "Lirik" : "Antrian"}
                </button>
              ))}
            </div>
            <div className="flex min-h-0 flex-1">{tab === "lyrics" ? <LyricsPanel /> : <QueuePanel />}</div>
          </div>
        </div>
      </div>

      {ctx && (
        <TrackMenu track={t} anchor={ctx} onClose={() => setCtx(null)} onAddToPlaylist={() => setAddOpen(true)} />
      )}
      {addOpen && <AddToPlaylistMenu track={t} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

const mini = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill2 text-label1";
