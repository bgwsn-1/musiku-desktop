"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import type { Track } from "@/lib/types";
import {
  IconDisc,
  IconHeart,
  IconNext,
  IconPause,
  IconPlay,
  IconPlus,
  IconQueue,
  IconTrash,
  IconUser,
} from "@/components/Icons";
import { Dialog } from "@/components/Dialog";
import { toast } from "@/components/Toast";

export type MenuAnchor = { x: number; y: number; end?: boolean };

type Item = {
  key: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
  danger?: boolean;
};

/**
 * Song actions. Reached three ways so nobody depends on a hidden gesture:
 * the ⋯ button (touch + keyboard), right-click, and long-press.
 * Phones get an action sheet; pointer devices get a popover at the cursor.
 */
export function TrackMenu({
  track,
  anchor,
  onClose,
  onAddToPlaylist,
  onRemove,
  removeLabel = "Keluarkan dari playlist",
}: {
  track: Track;
  anchor: MenuAnchor;
  onClose: () => void;
  onAddToPlaylist: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const p = usePlayer();
  const router = useRouter();
  const sheet = useMemo(
    () => window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768,
    [],
  );
  const isCurrent = p.current?.videoId === track.videoId;
  const liked = p.isLiked(track.videoId);

  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const items: Item[] = [
    {
      key: "play",
      label: isCurrent && p.playing ? "Jeda" : "Putar",
      icon: isCurrent && p.playing ? <IconPause className="h-[18px] w-[18px]" /> : <IconPlay className="h-[18px] w-[18px]" />,
      run: go(() => (isCurrent ? p.toggle() : p.playOne(track))),
    },
    {
      key: "next",
      label: "Putar berikutnya",
      icon: <IconNext className="h-[18px] w-[18px]" />,
      run: go(() => {
        if (!p.current) return p.playOne(track);
        p.enqueue(track, p.index + 1);
        toast("Diputar berikutnya");
      }),
    },
    {
      key: "queue",
      label: "Tambah ke antrian",
      icon: <IconQueue className="h-[18px] w-[18px]" />,
      run: go(() => {
        if (!p.current) return p.playOne(track);
        p.enqueue(track);
        toast("Ditambahkan ke antrian");
      }),
    },
    {
      key: "like",
      label: liked ? "Hapus dari favorit" : "Tambah ke favorit",
      icon: <IconHeart filled={liked} className={`h-[18px] w-[18px] ${liked ? "text-accent" : ""}`} />,
      run: go(() => {
        p.toggleLike(track);
        toast(liked ? "Dihapus dari favorit" : "Ditambahkan ke favorit");
      }),
    },
    {
      key: "playlist",
      label: "Tambah ke playlist…",
      icon: <IconPlus className="h-[18px] w-[18px]" />,
      run: go(onAddToPlaylist),
    },
  ];
  if (track.albumId)
    items.push({
      key: "album",
      label: "Lihat album",
      icon: <IconDisc className="h-[18px] w-[18px]" />,
      run: go(() => router.push(`/album/${track.albumId}`)),
    });
  if (track.artistId)
    items.push({
      key: "artist",
      label: "Lihat artis",
      icon: <IconUser className="h-[18px] w-[18px]" />,
      run: go(() => router.push(`/artist/${track.artistId}`)),
    });
  if (onRemove)
    items.push({
      key: "remove",
      label: removeLabel,
      icon: <IconTrash className="h-[18px] w-[18px]" />,
      run: go(onRemove),
      danger: true,
    });

  if (sheet) {
    return (
      <Dialog open onClose={onClose} title={track.title}>
        {track.artist && <p className="-mt-2 mb-3 truncate text-[14px] text-label2">{track.artist}</p>}
        <div className="-mx-2 space-y-0.5">
          {items.map((it, i) => (
            <button
              key={it.key}
              data-autofocus={i === 0 ? "" : undefined}
              onClick={it.run}
              className={`flex h-[52px] w-full items-center gap-4 rounded-xl px-3 text-left text-[16px] font-medium active:bg-fill2 ${
                it.danger ? "text-accent" : "text-label1"
              }`}
            >
              <span className={it.danger ? "" : "text-label2"}>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      </Dialog>
    );
  }
  return <Popover anchor={anchor} onClose={onClose} items={items} />;
}

function Popover({ anchor, onClose, items }: { anchor: MenuAnchor; onClose: () => void; items: Item[] }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // place inside the viewport, flipping up / left when there is no room
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const m = 8;
    let x = anchor.end ? anchor.x - width : anchor.x;
    let y = anchor.y;
    if (x + width > window.innerWidth - m) x = window.innerWidth - width - m;
    if (x < m) x = m;
    if (y + height > window.innerHeight - m) y = Math.max(m, anchor.y - height - (anchor.end ? 44 : 0));
    setPos({ x, y });
  }, [anchor]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const els = () => Array.from(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = els();
        const i = list.indexOf(document.activeElement as HTMLElement);
        const n = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
        list[n]?.focus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current();
      }
    };
    const away = () => closeRef.current();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("blur", away);
    window.addEventListener("resize", away);
    document.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", away);
      window.removeEventListener("resize", away);
      document.removeEventListener("scroll", away, true);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, []);

  // focus the first item once the menu is positioned (hidden elements can't take focus)
  useEffect(() => {
    if (pos) box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [pos]);

  return createPortal(
    <div
      ref={box}
      role="menu"
      aria-label="Aksi lagu"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? "visible" : "hidden" }}
      className="anim-pop glass glass-lg fixed z-[75] min-w-[232px] rounded-2xl p-1.5"
    >
      {items.map((it) => (
        <div key={it.key}>
          {it.danger && <div className="mx-2 my-1 h-px bg-[var(--hairline)]" role="separator" />}
          <button
            role="menuitem"
            onClick={it.run}
            className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium outline-none hover:bg-fill2 focus-visible:bg-fill2 ${
              it.danger ? "text-accent" : "text-label1"
            }`}
          >
            <span className={it.danger ? "" : "text-label2"}>{it.icon}</span>
            {it.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
