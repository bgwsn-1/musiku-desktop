// Resolver artwork Apple dipakai bersama ImmersiveLyrics & CoverFlow.
// Cache per trackKey: geser bolak-balik tidak fetch ulang; fetch dibatalkan
// (AbortController) begitu item yang diminta sudah tidak relevan.
import { useEffect, useState } from "react";

const cache = new Map();
const EMPTY = { ready: false, motion: null, still: null };

export const trackKeyOf = (t) =>
  t ? `${t.videoId}|${t.title || ""}|${t.artist || ""}` : "";

export function useAppleArtwork(track) {
  const trackKey = trackKeyOf(track);
  const [state, setState] = useState(() => {
    const hit = cache.get(trackKey);
    return { trackKey, ...(hit || EMPTY) };
  });

  useEffect(() => {
    if (!track || !trackKey) return;
    const hit = cache.get(trackKey);
    if (hit) {
      setState({ trackKey, ...hit });
      return;
    }
    let live = true;
    const ac = new AbortController();
    const q = new URLSearchParams();
    q.set("title", track.title || "");
    if (track.artist) q.set("artist", String(track.artist));

    fetch(`/api/apple-artwork?${q.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const value = { ready: true, motion: j?.motion || null, still: j?.still || null };
        cache.set(trackKey, value);
        if (live) setState({ trackKey, ...value });
      })
      .catch(() => {
        // Gagal tidak di-cache: bisa retry saat item dipilih lagi.
        if (live) setState({ trackKey, ready: true, motion: null, still: null });
      });

    return () => {
      live = false;
      ac.abort();
    };
  }, [trackKey]);

  return state.trackKey === trackKey ? state : EMPTY;
}
