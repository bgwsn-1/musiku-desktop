// Jembatan state lirik mengambang — HANYA untuk bundle desktop.
// Jendela utama tetap satu-satunya pemilik audio/PlayerProvider. File ini
// menyiarkan snapshot ke jendela overlay dan menerima aksi kontrol darinya.

import { useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player";
import { LYRICS_OVERLAY_CHANNEL } from "@/lib/lyrics-popout";

export default function LyricsBridge() {
  const p = usePlayer();
  const pRef = useRef(p);
  pRef.current = p;
  const bcRef = useRef(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(LYRICS_OVERLAY_CHANNEL);
    bcRef.current = bc;

    const publish = () => {
      const player = pRef.current;
      const t = player.current;
      bc.postMessage({
        type: "snapshot",
        videoId: t?.videoId ?? null,
        title: t?.title ?? "",
        artist: t?.artist ?? "",
        album: t?.album ?? "",
        artwork: t?.thumbs ?? null,
        playing: player.playing,
        position: player.position,
        duration: player.duration,
      });
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "hello") {
        publish();
        return;
      }
      if (data.type !== "action") return;
      const player = pRef.current;
      switch (data.action) {
        case "toggle":
          player.toggle();
          break;
        case "next":
          player.next();
          break;
        case "prev":
          player.prev();
          break;
        case "seek":
          if (typeof data.time === "number" && Number.isFinite(data.time)) {
            player.seek(data.time);
          }
          break;
        default:
          break;
      }
    };

    bc.addEventListener("message", onMessage);
    publish();
    return () => {
      bc.removeEventListener("message", onMessage);
      bc.close();
      bcRef.current = null;
    };
  }, []);

  // Kirim ulang setiap state pemutar berubah. `position` memang sering berubah,
  // tapi postMessage lintas jendela jauh lebih murah daripada IPC asli.
  useEffect(() => {
    if (!bcRef.current) return;
    const t = p.current;
    bcRef.current.postMessage({
      type: "snapshot",
      videoId: t?.videoId ?? null,
      title: t?.title ?? "",
      artist: t?.artist ?? "",
      album: t?.album ?? "",
      artwork: t?.thumbs ?? null,
      playing: p.playing,
      position: p.position,
      duration: p.duration,
    });
  }, [
    p.current?.videoId,
    p.current?.title,
    p.current?.artist,
    p.current?.album,
    p.current?.thumbs,
    p.playing,
    p.position,
    p.duration,
  ]);

  return null;
}
