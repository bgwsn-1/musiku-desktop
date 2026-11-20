"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import {
  IconEllipsis,
  IconFastForward,
  IconList,
  IconLyricsQuote,
  IconPause,
  IconPlay,
  IconRepeat,
  IconRepeatOne,
  IconRewind,
  IconShuffle,
  IconVolume,
  IconVolumeMute,
} from "@/components/Icons";
import { Scrubber } from "@/components/Scrubber";
import { AddToPlaylistMenu } from "@/components/TrackRow";
import { PlayerMenu } from "@/components/PlayerMenu";
import { Dialog } from "@/components/Dialog";
import { parseLrc } from "@/components/LyricsPanel";
import { toast } from "@/components/Toast";
import { Artwork } from "@/components/Artwork";
import { shareTrack } from "@/components/ShareCard";
import fmtTime from "@/lib/timefmt";
import type { Lyrics as LyricsData } from "@/lib/types";

/**
 * Full-screen player for phones. The artwork bleeds from the top edge and
 * fades into the backdrop; controls sit straight on it (content, not glass).
 * Swipe down on the top handle, tap it, or press Esc to close.
 */
export function NowPlaying({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePlayer();
  const router = useRouter();
  const t = p.current;
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const [menu, setMenu] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [info, setInfo] = useState(false);
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [lyr, setLyr] = useState<{ id: string | null; data: LyricsData | null; loading: boolean }>({
    id: null,
    data: null,
    loading: false,
  });
  const startY = useRef<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pRef = useRef(p);
  pRef.current = p;
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiOpen = !!p.ui;
  const id = t?.videoId ?? null;

  // stay mounted while the exit animation plays
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    setMenu(false);
    const tm = setTimeout(() => {
      setShown(false);
      setClosing(false);
      setDrag(0);
    }, 280);
    return () => clearTimeout(tm);
  }, [open, shown]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uiOpen && !document.querySelector("[role=dialog],[role=menu]")) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, uiOpen]);

  // current lyric line, shown above the progress bar
  useEffect(() => {
    if (!open || !id) return;
    let live = true;
    setLyr({ id, data: null, loading: true });
    fetch(`/api/lyrics/${id}`)
      .then((r) => r.json())
      .then((j) => live && setLyr({ id, data: j as LyricsData, loading: false }))
      .catch(() => live && setLyr({ id, data: null, loading: false }));
    return () => {
      live = false;
    };
  }, [open, id]);

  const lines = useMemo(
    () => (lyr.id === id && lyr.data?.synced && lyr.data.text ? parseLrc(lyr.data.text) : []),
    [lyr, id],
  );
  const lineText = useMemo(() => {
    if (lyr.id !== id || lyr.loading) return "Memuat lirik…";
    if (!lines.length) return "";
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= p.position) idx = i;
      else break;
    }
    return idx < 0 ? "♪" : lines[idx].text || "♪";
  }, [lines, lyr, id, p.position]);

  useEffect(
    () => () => {
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
    },
    [],
  );

  const setSleep = (min: number | null) => {
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = null;
    if (!min) {
      setSleepUntil(null);
      toast("Pewaktu tidur dimatikan");
      return;
    }
    setSleepUntil(Date.now() + min * 60000);
    sleepTimer.current = setTimeout(() => {
      if (pRef.current.playing) pRef.current.toggle();
      sleepTimer.current = null;
      setSleepUntil(null);
      toast("Pewaktu tidur: musik dijeda");
    }, min * 60000);
    toast(`Musik berhenti dalam ${min} menit`);
  };

  if (!shown || !t) return null;
  const liked = p.isLiked(t.videoId);
  const remaining = Math.max(0, (p.duration || 0) - p.position);
  const from = t.album || t.artist;

  const round =
    "flex items-center justify-center rounded-full transition-[background-color,transform,opacity] duration-200 active:scale-90";
  const tool = (on: boolean) =>
    `${round} h-12 w-12 ${on ? "bg-white/20 text-white" : "text-label2 active:text-white"}`;

  const go = (href: string) => {
    router.push(href);
    onClose();
  };
  const share = () => void shareTrack(t, p.duration ? p.position / p.duration : 0);
  const sleepLabel = sleepUntil
    ? `Aktif sampai ${new Date(sleepUntil).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
    : null;
  const artH = "clamp(260px, calc(100dvh - 430px), 100vw)";

  return (
    <div
      role="region"
      aria-label="Sedang diputar"
      style={{ ["--drag" as string]: `${drag}px` } as React.CSSProperties}
      className={`force-dark ${closing ? "panel-out pointer-events-none" : "panel-in"} fixed inset-0 z-[44] flex flex-col overflow-hidden bg-black text-label1 lg:hidden`}
    >
      {/* tint from the artwork */}
      <div className="np-backdrop" aria-hidden="true">
        <Artwork key={t.videoId} src={t.thumbs} quiet />
      </div>

      {/* artwork bleeds from the top edge and fades out */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: artH,
          WebkitMaskImage: "linear-gradient(to bottom, #000 58%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, #000 58%, transparent 100%)",
        }}
      >
        <Artwork src={t.thumbs} alt={`Sampul ${t.title}`} eager />
      </div>

      {/* handle: tap or swipe down to close, with the source underneath */}
      <div
        className="relative z-10 flex shrink-0 touch-none flex-col items-center pt-[max(6px,env(safe-area-inset-top))]"
        onPointerDown={(e) => {
          startY.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current));
        }}
        onPointerUp={() => {
          const far = drag > 120;
          startY.current = null;
          if (far) onClose();
          else setDrag(0);
        }}
        onPointerCancel={() => {
          startY.current = null;
          setDrag(0);
        }}
      >
        <button ref={closeBtn} onClick={onClose} className="flex h-8 w-28 items-center justify-center" aria-label="Tutup pemutar">
          <span className="h-[5px] w-10 rounded-full bg-white/70" aria-hidden="true" />
        </button>
        {from && (
          <p className="mt-0.5 max-w-[70%] truncate text-[13px] font-medium text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
            Memutar dari {from}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1" />

      <div className="relative z-10 shrink-0 px-[18px] pb-[calc(env(safe-area-inset-bottom)+18px)]">
        {/* title + more */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[22px] font-bold leading-tight tracking-[-0.015em]">{t.title}</h2>
            {t.artist && <p className="truncate text-[19px] leading-tight text-label3">{t.artist}</p>}
          </div>
          <button
            onClick={() => setMenu(true)}
            className={`${round} h-10 w-10 shrink-0 bg-white/15 text-white`}
            aria-haspopup="menu"
            aria-label="Opsi lainnya"
          >
            <IconEllipsis className="h-[20px] w-[20px]" />
          </button>
        </div>

        {/* current lyric line */}
        <button
          onClick={() => p.toggleUi("lyrics")}
          className="mt-7 block h-6 w-full truncate text-left text-[16px] leading-6 text-label2"
          aria-label="Buka lirik"
          tabIndex={lineText ? 0 : -1}
        >
          {lineText}
        </button>

        {/* progress */}
        <div className="mt-1.5">
          <Scrubber fat position={p.position} duration={p.duration || 0} onSeek={p.seek} />
          <div className="mt-0 flex justify-between text-[13px] font-medium text-label2 tnum">
            <span>{fmtTime(p.position)}</span>
            <span>{p.duration ? `-${fmtTime(remaining)}` : "--:--"}</span>
          </div>
        </div>

        {/* transport: bare glyphs */}
        <div className="mt-5 grid grid-cols-3 place-items-center px-1">
          <button onClick={p.prev} className={`${round} h-[72px] w-[88px] text-white`} aria-label="Lagu sebelumnya">
            <IconRewind className="h-[27px] w-[48px]" />
          </button>
          <button onClick={p.toggle} className={`${round} h-[72px] w-[88px] text-white`} aria-label={p.playing ? "Jeda" : "Putar"}>
            {p.resolving ? (
              <svg viewBox="0 0 24 24" className="spin h-9 w-9" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0110 10h-2a8 8 0 00-8-8V2z" />
              </svg>
            ) : p.playing ? (
              <span key="p" className="anim-pop inline-flex">
                <IconPause className="h-[42px] w-[42px]" />
              </span>
            ) : (
              <span key="s" className="anim-pop inline-flex">
                <IconPlay className="h-[46px] w-[46px] translate-x-0.5" />
              </span>
            )}
          </button>
          <button onClick={p.next} className={`${round} h-[72px] w-[88px] text-white`} aria-label="Lagu berikutnya">
            <IconFastForward className="h-[27px] w-[48px]" />
          </button>
        </div>

        {/* volume */}
        <div className="mt-5 flex items-center gap-3 text-label2">
          <button
            onClick={p.toggleMute}
            className="flex h-10 w-6 shrink-0 items-center justify-center"
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
            className="appleslider thick min-w-0 flex-1"
            style={{ ["--fill" as string]: `${(p.muted ? 0 : p.volume) * 100}%` } as React.CSSProperties}
            aria-label="Volume"
          />
          <IconVolume className="h-[24px] w-[24px] shrink-0" />
        </div>

        {/* tools */}
        <div className="mt-3 flex items-center justify-between px-3">
          <button onClick={() => p.toggleUi("lyrics")} className={tool(p.ui === "lyrics")} aria-pressed={p.ui === "lyrics"} aria-label="Lirik">
            <IconLyricsQuote className="h-[24px] w-[24px]" />
          </button>
          <button onClick={p.toggleShuffle} className={tool(p.shuffle)} aria-pressed={p.shuffle} aria-label="Acak">
            <IconShuffle className="h-[24px] w-[24px]" />
          </button>
          <button
            onClick={p.cycleRepeat}
            className={tool(p.repeat !== "off")}
            aria-pressed={p.repeat !== "off"}
            aria-label={`Ulangi: ${p.repeat === "off" ? "mati" : p.repeat === "all" ? "semua" : "satu lagu"}`}
          >
            {p.repeat === "one" ? <IconRepeatOne className="h-[24px] w-[24px]" /> : <IconRepeat className="h-[24px] w-[24px]" />}
          </button>
          <button onClick={() => p.toggleUi("queue")} className={tool(p.ui === "queue")} aria-pressed={p.ui === "queue"} aria-label="Antrian">
            <IconList className="h-[26px] w-[26px]" />
          </button>
        </div>
      </div>

      {menu && (
        <PlayerMenu
          track={t}
          liked={liked}
          sleepLabel={sleepLabel}
          crossfade={p.crossfade}
          cfSec={p.cfSec}
          onCrossfade={() => {
            p.toggleCrossfade();
            toast(p.crossfade ? "Crossfade dimatikan" : `Crossfade aktif — ${p.cfSec} detik`);
          }}
          onCfSec={(n) => {
            p.setCfSec(n);
            toast(`Crossfade ${n} detik`);
          }}
          onClose={() => setMenu(false)}
          onShare={share}
          onPlayNext={() => {
            p.enqueue(t, p.index + 1);
            toast("Diputar berikutnya");
          }}
          onQueue={() => {
            p.enqueue(t);
            toast("Ditambahkan ke antrian");
          }}
          onLike={() => p.toggleLike(t)}
          onPlaylist={() => setAddOpen(true)}
          onAlbum={t.albumId ? () => go(`/album/${t.albumId}`) : undefined}
          onArtist={t.artistId ? () => go(`/artist/${t.artistId}`) : undefined}
          onInfo={() => setInfo(true)}
          onSleep={setSleep}
        />
      )}
      {addOpen && <AddToPlaylistMenu track={t} onClose={() => setAddOpen(false)} />}
      <Dialog open={info} onClose={() => setInfo(false)} title="Info lagu">
        <dl className="space-y-3 text-[15px]">
          {(
            [
              ["Judul", t.title],
              ["Artis", t.artist],
              ["Album", t.album],
              ["Durasi", p.duration ? fmtTime(p.duration) : t.duration],
              ["ID video", t.videoId],
            ] as [string, string | number | null | undefined][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] text-label3">{k}</dt>
                <dd className="break-words text-label1">{String(v)}</dd>
              </div>
            ))}
        </dl>
      </Dialog>
    </div>
  );
}
