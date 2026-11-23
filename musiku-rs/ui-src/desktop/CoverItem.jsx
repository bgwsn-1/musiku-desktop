// Satu cover carousel: thumbnail ringan / still resolusi tinggi untuk tengah,
// fallback ikon musik kalau gambar gagal dimuat.
import { useEffect, useState } from "react";
import { IconEllipsis, IconMusic } from "@/components/Icons";

export function CoverItem({ track, index, active, src, register, onSelect, onMenu }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const showImg = !!src && !failed;
  const title = track.title || "Lagu tanpa judul";
  const artist = track.artist || "Artis tidak diketahui";

  return (
    <div
      ref={(el) => register(index, el)}
      className="cf-item"
      data-active={active ? "1" : undefined}
    >
      <button
        type="button"
        className="cf-hit"
        onClick={() => onSelect(index)}
        aria-label={`${title} - ${artist}`}
        aria-current={active ? "true" : undefined}
        tabIndex={active ? 0 : -1}
      >
        <span className="cf-card">
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
        </span>
        <span className="cf-caption">
          <span className="cf-title">{title}</span>
          <span className="cf-artist">{artist}</span>
        </span>
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
  );
}
