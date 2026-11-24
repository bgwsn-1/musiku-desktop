// Satu cover carousel: thumbnail ringan / still resolusi tinggi untuk tengah,
// fallback ikon musik kalau gambar gagal dimuat.
import { useEffect, useRef, useState } from "react";
import { IconEllipsis, IconMusic } from "@/components/Icons";
import { CF_FX } from "./coverFlowMath";

export function CoverItem({
  track,
  index,
  active,
  history = false,
  showLabel = true,
  pulse = 0,
  captionKey,
  playing = false,
  src,
  register,
  onSelect,
  onMenu,
}) {
  const [failed, setFailed] = useState(false);
  const [pop, setPop] = useState(false);
  const [pressed, setPressed] = useState(false);
  const lastPulse = useRef(pulse);
  useEffect(() => setFailed(false), [src]);

  // Pulse naik hanya saat p.index berubah. Semua cover menerima pulse yang sama,
  // jadi cover yang baru jadi aktif karena browsing tidak ikut "pop".
  useEffect(() => {
    if (lastPulse.current === pulse) return;
    lastPulse.current = pulse;
    if (!active || history) return;
    setPop(false);
    const raf = requestAnimationFrame(() => setPop(true));
    const end = setTimeout(() => setPop(false), CF_FX.popMs + 40);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(end);
    };
  }, [pulse, active, history]);

  const showImg = !!src && !failed;
  const title = track.title || "Lagu tanpa judul";
  const artist = track.artist || "Artis tidak diketahui";
  const label = history ? `Riwayat: ${title} - ${artist}` : `${title} - ${artist}`;

  return (
    <div
      ref={(el) => register(index, el)}
      className={`cf-item${history ? " cf-item-history" : ""}`}
      data-active={active ? "1" : undefined}
      data-playing={active && !history ? (playing ? "1" : "0") : undefined}
      aria-hidden={history ? "true" : undefined}
    >
      {/* Wrapper scale: membungkus kartu + menu, bukan transform 3D dari .cf-item. */}
      <div
        className="cf-scale"
        data-pressed={pressed ? "1" : undefined}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
      >
        <div className="cf-card" data-pop={pop ? "1" : undefined}>
          <button
            type="button"
            className="cf-hit"
            onClick={() => onSelect(index)}
            disabled={history}
            aria-label={label}
            aria-current={active ? "true" : undefined}
            tabIndex={active && !history ? 0 : -1}
          >
            {showImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                className="cf-img"
                loading={active ? "eager" : "lazy"}
                fetchPriority={active ? "high" : undefined}
                onError={() => setFailed(true)}
              />
            ) : (
              <span className="cf-fallback">
                <IconMusic className="h-1/3 w-1/3 text-label3" />
              </span>
            )}
          </button>
          {active && (
            <button
              type="button"
              className="cf-more"
              onClick={(e) => onMenu(index, e)}
              aria-haspopup="menu"
              aria-label="Opsi lainnya"
            >
              <IconEllipsis className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
      {showLabel && (
        <button
          type="button"
          className="cf-caption"
          key={captionKey ?? track.videoId}
          onClick={() => onSelect(index)}
          disabled={history}
          tabIndex={-1}
        >
          <span className="cf-title">{title}</span>
          <span className="cf-artist-line">
            <span className="cf-artist">{artist}</span>
            {active && !history && (
              <span className="cf-badge" title="Audio dari YouTube Music (AAC/Opus)">
                LOSSY
              </span>
            )}
          </span>
        </button>
      )}
    </div>
  );
}
