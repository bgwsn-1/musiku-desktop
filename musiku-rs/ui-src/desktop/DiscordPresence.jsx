// Jembatan Discord Rich Presence — hanya dipasang di bundle desktop.
// Web/Android tidak mengimpor file ini, jadi perilaku pemutarnya tetap sama.
import { useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player";

const invoke = (cmd, args) => window.__TAURI_INTERNALS__?.invoke?.(cmd, args);

export default function DiscordPresence() {
  const player = usePlayer();
  // Baca posisi terbaru tanpa memasukkan `position` ke dependency effect —
  // nilainya berubah tiap frame dan akan memicu IPC terus-menerus.
  const latest = useRef(player);
  latest.current = player;

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__?.invoke) return;

    let timer = null;
    const send = async () => {
      const p = latest.current;
      const track = p.current;
      if (!track || !p.playing) {
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
    // 10 detik sudah cukup menjaga timestamp Discord akurat, sekaligus
    // memotong frekuensi IPC jadi separuh (dulu 5 detik).
    timer = setInterval(() => void send(), 10000);

    // Saat ganti lagu effect ini di-re-run. JANGAN clear di sini: clear lalu
    // set berdempetan dua-duanya menyentuh socket Discord persis di momen
    // ganti lagu. Cukup matikan timer lama; effect baru langsung kirim lagu
    // baru.
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
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
