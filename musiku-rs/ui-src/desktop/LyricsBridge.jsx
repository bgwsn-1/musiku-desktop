// Jembatan state lirik mengambang — HANYA untuk bundle desktop.
// Jendela utama tetap satu-satunya pemilik audio/PlayerProvider. File ini
// menyiarkan snapshot ke jendela overlay dan menerima aksi kontrol darinya.

import { useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player";
import { LYRICS_OVERLAY_CHANNEL } from "@/lib/lyrics-popout";

function snapshotOf(player, art) {
  const t = player.current;
  const key = t ? `${t.videoId}|${t.title || ""}|${t.artist || ""}` : "";
  return {
    type: "snapshot",
    videoId: t?.videoId ?? null,
    title: t?.title ?? "",
    artist: t?.artist ?? "",
    album: t?.album ?? "",
    // Cover statis Apple biasanya 1200×1200, jauh lebih tajam dari cover YT.
    artwork: (art.key === key && art.url) || t?.thumbs || null,
    playing: player.playing,
    position: player.position,
    duration: player.duration,
  };
}

export default function LyricsBridge() {
  const p = usePlayer();
  const pRef = useRef(p);
  pRef.current = p;
  const bcRef = useRef(null);
  const artRef = useRef({ key: "", url: null });

  // Prioritas artwork sama seperti di immersive lyrics: cover statis Apple,
  // lalu jatuh ke cover YouTube Music kalau Apple tidak menyediakan.
  useEffect(() => {
    const t = p.current;
    const key = t ? `${t.videoId}|${t.title || ""}|${t.artist || ""}` : "";
    if (!key) {
      artRef.current = { key, url: null };
      return;
    }
    let live = true;
    const ac = new AbortController();
    const q = new URLSearchParams();
    q.set("title", t.title || "");
    if (t.artist) q.set("artist", String(t.artist));
    fetch(`/api/apple-artwork?${q.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live) return;
        artRef.current = { key, url: j?.still || null };
        bcRef.current?.postMessage(snapshotOf(pRef.current, artRef.current));
      })
      .catch(() => {});
    return () => {
      live = false;
      ac.abort();
    };
  }, [p.current?.videoId, p.current?.title, p.current?.artist]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(LYRICS_OVERLAY_CHANNEL);
    bcRef.current = bc;

    const publish = () => {
      bc.postMessage(snapshotOf(pRef.current, artRef.current));
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
    bcRef.current.postMessage(snapshotOf(p, artRef.current));
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
