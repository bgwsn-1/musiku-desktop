"use client";

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
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export function openLyricsPopout(): void {
  void invoke("open_lyrics_overlay");
}

export function closeLyricsPopout(): void {
  void invoke("close_lyrics_overlay");
}
