"use client";

import { toast } from "@/components/Toast";

/** Channel shared by the main window and the floating lyrics webview. */
export const LYRICS_OVERLAY_CHANNEL = "musiku:lyrics-overlay";

export type OverlaySnapshot = {
  type: "snapshot";
  videoId: string | null;
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  playing: boolean;
  position: number;
  duration: number;
};

export type OverlayAction = {
  type: "action";
  action: "toggle" | "next" | "prev" | "seek";
  time?: number;
};

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: Invoke } })
    .__TAURI_INTERNALS__?.invoke;
  return fn ? fn(cmd, args) : null;
}

export function isDesktopClient(): boolean {
  if (typeof window === "undefined") return false;
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: unknown } })
    .__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function";
}

function fire(cmd: string, failure: string, success?: string): void {
  const result = invoke(cmd);
  if (!result) {
    toast(failure);
    return;
  }
  result
    .then(() => {
      if (success) toast(success);
    })
    .catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[lyrics-popout] ${cmd} gagal`, error);
      toast(`${failure}: ${detail}`);
    });
}

export function openLyricsPopout(): void {
  if (!isDesktopClient()) {
    toast("Lirik mengambang hanya tersedia di aplikasi desktop");
    return;
  }
  toast("Membuka lirik mengambang…");
  fire("open_lyrics_overlay", "Gagal membuka lirik mengambang", "Jendela lirik dibuka");
}

export function closeLyricsPopout(): void {
  fire("close_lyrics_overlay", "Gagal menutup lirik mengambang");
}
