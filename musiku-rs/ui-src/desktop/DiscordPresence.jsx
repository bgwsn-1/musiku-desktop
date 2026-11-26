// Jembatan Discord Rich Presence hanya untuk bundle desktop.
// Mendukung toggle aktif/nonaktif dari Halaman Pengaturan (localStorage).
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";

const invoke = (cmd, args) => window.__TAURI_INTERNALS__?.invoke?.(cmd, args);
export const LS_DISCORD_RPC = "musiku.discord.rpc";
export const DISCORD_RPC_EVENT = "musiku:discord-rpc-change";

export function readDiscordRpcEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(LS_DISCORD_RPC) !== "0";
  } catch {
    return true;
  }
}

export function setDiscordRpcEnabled(enabled) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_DISCORD_RPC, enabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent(DISCORD_RPC_EVENT, { detail: enabled }));
  } catch {
    // Abaikan storage terkunci
  }
}

export default function DiscordPresence() {
  const player = usePlayer();
  const [enabled, setEnabled] = useState(() => readDiscordRpcEnabled());
  const latest = useRef(player);
  latest.current = player;

  useEffect(() => {
    const onChange = (e) => {
      setEnabled(Boolean(e?.detail ?? readDiscordRpcEnabled()));
    };
    window.addEventListener(DISCORD_RPC_EVENT, onChange);
    return () => window.removeEventListener(DISCORD_RPC_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__?.invoke) return;

    let timer = null;
    const send = async () => {
      const p = latest.current;
      const track = p.current;
      if (!enabled || !track || !p.playing) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        try {
          await invoke("discord_clear_activity");
        } catch {}
        return;
      }
      try {
        await invoke("discord_set_activity", {
          payload: {
            title: track.title || "Lagu tanpa judul",
            artist: track.artist || track.artists?.[0] || null,
            album: track.album || null,
            artwork: track.thumbs || null,
            position: Math.max(0, p.position || 0),
            duration: Math.max(0, p.duration || 0),
          },
        });
      } catch {}
    };

    void send();
    if (enabled) {
      timer = setInterval(() => void send(), 10000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    enabled,
    player.current?.videoId,
    player.current?.title,
    player.current?.artist,
    player.current?.album,
    player.current?.thumbs,
    player.playing,
    player.duration,
  ]);

  return null;
}
