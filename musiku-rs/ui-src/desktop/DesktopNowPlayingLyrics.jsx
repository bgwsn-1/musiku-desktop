// Lirik Playing Screen 100% mengikuti YesPlayMusic (lib/pages/now_playing.dart _Lyrics):
// - Semua baris dirender dengan ArchivoWide 40px w900 (line-height 1.1) agar pemotongan baris tetap stabil.
// - Baris non-aktif diperkecil dengan scale(0.55) (~22px) dan jarak visual 24px tanpa re-wrap teks.
// - Opacity bertingkat berdasarkan jarak dari baris aktif: 1.0 / 0.50 / 0.30 / 0.18.
// - Scroll manual masuk mode browsing (semua 0.55, opacity 0.45, aktif 1.0), otomatis kembali setelah 3 detik.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { parseLrc } from "@/components/LyricsPanel";

const SCALE_SMALL = 0.55;
const GAP_ACTIVE = 30;
const GAP_SMALL = 22;

function distanceOpacity(dist, browsing) {
  if (browsing) return dist === 0 ? 1 : 0.45;
  if (dist === 0) return 1;
  if (dist === 1) return 0.5;
  if (dist === 2) return 0.3;
  return 0.18;
}

export const DesktopNowPlayingLyrics = memo(function DesktopNowPlayingLyrics({
  trackId,
  onStatus,
}) {
  const { position, seek } = usePlayer();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [browsing, setBrowsing] = useState(false);
  const [heights, setHeights] = useState([]);

  const scrollRef = useRef(null);
  const rowRefs = useRef([]);
  const browseTimer = useRef(null);
  const lastScrolledIdx = useRef(-2);

  useEffect(() => {
    setData(null);
    setHeights([]);
    setBrowsing(false);
    lastScrolledIdx.current = -2;
    if (!trackId) {
      setLoading(false);
      onStatus?.({ loading: false, hasLyrics: false });
      return;
    }
    let live = true;
    setLoading(true);
    onStatus?.({ loading: true, hasLyrics: false });

    fetch(`/api/lyrics/${encodeURIComponent(trackId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live) return;
        setData(j);
        const has = Boolean(j?.text && j.text.trim().length > 0);
        setLoading(false);
        onStatus?.({ loading: false, hasLyrics: has });
      })
      .catch(() => {
        if (!live) return;
        setData(null);
        setLoading(false);
        onStatus?.({ loading: false, hasLyrics: false });
      });

    return () => {
      live = false;
    };
  }, [trackId, onStatus]);

  const syncedLines = useMemo(() => {
    if (!data?.synced || !data?.text) return [];
    return parseLrc(data.text).filter((l) => l.text && l.text.trim().length > 0);
  }, [data]);

  const plainLines = useMemo(() => {
    if (data?.synced || !data?.text) return [];
    return data.text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [data]);

  // Ukur tinggi asli setiap baris pada ukuran 40px sekali saja agar kompensasi scale(0.55) presisi
  const measureRows = useCallback(() => {
    if (!syncedLines.length) return;
    const next = syncedLines.map((_, i) => {
      const el = rowRefs.current[i];
      return el ? el.offsetHeight : 44;
    });
    setHeights(next);
  }, [syncedLines]);

  useEffect(() => {
    if (!syncedLines.length) return;
    const id = requestAnimationFrame(measureRows);
    const onResize = () => measureRows();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [syncedLines, measureRows]);

  // Indeks baris aktif
  const activeIdx = useMemo(() => {
    if (!syncedLines.length) return -1;
    const t = position + 0.15;
    let idx = 0;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= t) idx = i;
      else break;
    }
    return idx;
  }, [syncedLines, position]);

  // Ikuti baris aktif di posisi ~30% tinggi kontainer (seperti YesPlayMusic anchor = 0.30)
  useEffect(() => {
    if (browsing || activeIdx < 0 || !scrollRef.current) return;
    if (activeIdx === lastScrolledIdx.current) return;
    lastScrolledIdx.current = activeIdx;

    const container = scrollRef.current;
    const row = rowRefs.current[activeIdx];
    if (!row) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetTop = Math.max(0, row.offsetTop - container.clientHeight * 0.3);
    container.scrollTo({
      top: targetTop,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [activeIdx, browsing, heights.length]);

  const enterBrowsing = useCallback(() => {
    setBrowsing(true);
    if (browseTimer.current) clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => {
      setBrowsing(false);
      lastScrolledIdx.current = -2;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (browseTimer.current) clearTimeout(browseTimer.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="ypm-np-lyrics-loading" aria-busy="true">
        Memuat lirik...
      </div>
    );
  }

  if (syncedLines.length > 0) {
    return (
      <div
        ref={scrollRef}
        className="ypm-np-lyrics-scroll"
        onWheel={enterBrowsing}
        onTouchMove={enterBrowsing}
      >
        <div className="ypm-np-lyrics-pad-top" />
        <div className="ypm-np-lyrics-col">
          {syncedLines.map((line, i) => {
            const dist = Math.abs(i - activeIdx);
            const isEnlarged = i === activeIdx && !browsing;
            const op = distanceOpacity(dist, browsing);
            const h = heights[i] || 44;
            const mb = isEnlarged
              ? GAP_ACTIVE
              : Math.round(h * (SCALE_SMALL - 1) + GAP_SMALL);

            return (
              <button
                key={`${i}-${line.time}`}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                type="button"
                onClick={() => {
                  if (browseTimer.current) clearTimeout(browseTimer.current);
                  setBrowsing(false);
                  lastScrolledIdx.current = -2;
                  seek(line.time);
                }}
                aria-current={i === activeIdx ? "true" : undefined}
                className={`ypm-np-lrc-row ${isEnlarged ? "is-current" : ""}`}
                style={{
                  "--lrc-op": op,
                  "--lrc-scale": isEnlarged ? 1 : SCALE_SMALL,
                  marginBottom: `${mb}px`,
                }}
              >
                {line.text}
              </button>
            );
          })}
        </div>
        <div className="ypm-np-lyrics-pad-bottom" />
      </div>
    );
  }

  if (plainLines.length > 0) {
    return (
      <div className="ypm-np-lyrics-scroll">
        <div className="ypm-np-lyrics-col ypm-np-lyrics-plain">
          {plainLines.map((line, i) => (
            <p key={i} className="ypm-np-lrc-plain">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return null;
});
