// Lirik mengambang — HANYA untuk bundle desktop (Windows/Linux).
// Jendela ini tidak memasang PlayerProvider dan tidak memutar audio. Ia hanya
// menerima snapshot lewat BroadcastChannel dan mengirim aksi ke jendela utama.

import { useEffect, useMemo, useRef, useState } from "react";
import { parseLrc } from "@/components/LyricsPanel";
import { IconClose, IconPause, IconPlay } from "@/components/Icons";
import {
  closeLyricsPopout,
  LYRICS_OVERLAY_CHANNEL,
} from "@/lib/lyrics-popout";

const EMPTY = {
  type: "snapshot",
  videoId: null,
  title: "",
  artist: "",
  album: "",
  artwork: null,
  playing: false,
  position: 0,
  duration: 0,
};

export default function LyricsOverlay() {
  const [snap, setSnap] = useState(EMPTY);
  const [lyrics, setLyrics] = useState(null);
  const channel = useRef(null);

  useEffect(() => {
    document.title = "Lirik — Musiku";
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(LYRICS_OVERLAY_CHANNEL);
    channel.current = bc;
    bc.addEventListener("message", (event) => {
      if (event.data?.type === "snapshot") setSnap(event.data);
    });
    let tries = 0;
    const hello = setInterval(() => {
      bc.postMessage({ type: "hello" });
      if (++tries >= 12) clearInterval(hello);
    }, 400);
    bc.postMessage({ type: "hello" });
    return () => {
      clearInterval(hello);
      bc.close();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    setLyrics(null);
    if (!snap.videoId) return;
    let live = true;
    fetch(`/api/lyrics/${snap.videoId}`)
      .then((r) => r.json())
      .then((j) => live && setLyrics(j))
      .catch(() => live && setLyrics(null));
    return () => {
      live = false;
    };
  }, [snap.videoId]);

  const lines = useMemo(
    () => (lyrics?.synced && lyrics.text ? parseLrc(lyrics.text) : []),
    [lyrics],
  );
  const plain = !lyrics?.synced && lyrics?.text ? lyrics.text.split(/\r?\n/).filter(Boolean) : [];

  const activeIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= snap.position) idx = i;
      else break;
    }
    return idx;
  }, [lines, snap.position]);

  const send = (action, time) => {
    channel.current?.postMessage({ type: "action", action, time });
  };

  // Active line sits at 52% of the mask, like the Figma component.
  // Baris biasa 8cqw, baris aktif 11cqw → setengahnya 5.5cqw.
  const offsetCqw = activeIdx >= 0 ? activeIdx * 8 + 5.5 : 5.5;
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="lo-root force-dark">
      <div data-tauri-drag-region className="lo-drag" aria-hidden="true" />

      {snap.artwork ? (
        <img key={snap.artwork} className="lo-art" src={snap.artwork} alt="" />
      ) : (
        <div className="lo-art lo-fallback" aria-hidden="true" />
      )}
      <div className="lo-scrim" aria-hidden="true" />

      <div className="lo-head">
        <div className="lo-eyebrow">Listening to</div>
        <div className="lo-title" title={snap.title}>
          {snap.title || "Musiku"}
        </div>
        {snap.artist && (
          <div className="lo-artist" title={snap.artist}>
            {snap.artist}
          </div>
        )}
      </div>

      <button
        onClick={() => closeLyricsPopout()}
        className="lo-close"
        aria-label="Tutup lirik mengambang"
        title="Tutup"
      >
        <IconClose className="h-full w-full" />
      </button>

      <div className="lo-lyrics" aria-live="polite">
        {lines.length ? (
          <div
            className="lo-lyrics-inner"
            style={{
              top: "52%",
              transform: `translateY(${-offsetCqw}cqw)`,
              transition: reduced ? "none" : "transform 680ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {lines.map((line, i) => (
              <button
                key={`${line.time}-${i}`}
                onClick={() => send("seek", line.time)}
                className={`lo-line ${i === activeIdx ? "is-active" : ""}`}
                title={`Lompat ke ${Math.floor(line.time / 60)}:${String(Math.floor(line.time % 60)).padStart(2, "0")}`}
              >
                {line.text || "·"}
              </button>
            ))}
          </div>
        ) : plain.length ? (
          <div className="lo-plain">{plain.slice(0, 8).join("\n")}</div>
        ) : (
          <div className="lo-empty">{snap.videoId ? "Mencari lirik…" : "Tidak ada lagu"}</div>
        )}
      </div>

      <div className="lo-controls">
        <div className={`lo-wave ${snap.playing ? "is-playing" : ""}`} aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="lo-wave-bar"
              style={{ animationDelay: `${(i % 8) * 90}ms`, height: `${28 + ((i * 37) % 72)}%` }}
            />
          ))}
        </div>
        <button
          onClick={() => send("toggle")}
          className="lo-play"
          aria-label={snap.playing ? "Jeda" : "Putar"}
          title={snap.playing ? "Jeda" : "Putar"}
        >
          {snap.playing ? <IconPause className="h-full w-full" /> : <IconPlay className="h-full w-full" />}
        </button>
      </div>
    </div>
  );
}
