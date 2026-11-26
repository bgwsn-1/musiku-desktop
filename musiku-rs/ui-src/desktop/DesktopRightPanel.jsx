// Panel kanan shell desktop: toolbar antrean/lirik, kartu Now Playing,
// daftar Playing Next bernomor, dan footer AutoPlay dengan estimasi sisa durasi.
import { usePlayer } from "@/lib/player";
import { LyricsPanel } from "@/components/LyricsPanel";
import { LiquidGlass } from "@/components/ui/apple-tahoe-liquid-glass-button";
import {
  IconClose,
  IconLyrics,
  IconMusic,
  IconQueue,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconTrash,
} from "@/components/Icons";

function IconInfinity({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
    </svg>
  );
}

function durationSecs(d) {
  if (typeof d === "number" && Number.isFinite(d) && d > 0) return d;
  if (typeof d === "string") {
    const parts = d.split(":").map((x) => Number(x));
    if (parts.length === 2 && parts.every(Number.isFinite)) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 0;
}

function formatTotalMins(totalSec) {
  if (!totalSec || totalSec <= 0) return null;
  const mins = Math.round(totalSec / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}j ${m}m` : `${h}j`;
  }
  return `${mins} menit`;
}

export function DesktopRightPanel({
  open,
  mode,
  onChangeMode,
  onClose,
  onOpenImmersive,
  isMobile,
}) {
  const {
    current,
    queue,
    index,
    shuffle,
    repeat,
    autoplay,
    toggleShuffle,
    cycleRepeat,
    toggleAutoplay,
    jumpTo,
    removeFromQueue,
  } = usePlayer();

  if (!open) return null;

  const list = Array.isArray(queue) ? queue : [];
  const upcoming =
    index >= 0 && index + 1 < list.length
      ? list.slice(index + 1).map((t, off) => ({ track: t, realIndex: index + 1 + off }))
      : list.map((t, i) => ({ track: t, realIndex: i }));

  const remainingSecs = list
    .slice(Math.max(0, index + 1))
    .reduce((acc, item) => acc + durationSecs(item.duration), 0);
  const remText = formatTotalMins(remainingSecs);
  const currentArtist = current?.artist || current?.artists?.[0] || "";
  const curSub = [currentArtist, current?.album].filter(Boolean).join(" · ");

  return (
    <>
      {isMobile && (
        <div
          className="ds-backdrop lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="ds-right"
        data-mobile={isMobile ? "1" : undefined}
        aria-label={mode === "lyrics" ? "Panel Lirik" : "Panel Antrean"}
      >
        <div className="ds-right-bar">
          <LiquidGlass
            material="regular"
            appearance="dark"
            refraction={10}
            bezel={16}
            blur={1.2}
            fallbackBlur={18}
            saturation={1.3}
            brightness={1.04}
            interactive={false}
            className="ds-right-tools"
          >
            <button
              type="button"
              className="ds-pbtn"
              onClick={() => onChangeMode("queue")}
              data-active={mode === "queue" ? "1" : undefined}
              aria-pressed={mode === "queue"}
              aria-label="Tampilkan antrean"
              title="Antrean"
            >
              <IconQueue className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ds-pbtn"
              onClick={() => onChangeMode("lyrics")}
              data-active={mode === "lyrics" ? "1" : undefined}
              aria-pressed={mode === "lyrics"}
              aria-label="Tampilkan lirik"
              title="Lirik"
            >
              <IconLyrics className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ds-pbtn"
              onClick={toggleShuffle}
              data-active={shuffle ? "1" : undefined}
              aria-pressed={!!shuffle}
              aria-label={shuffle ? "Matikan acak" : "Aktifkan acak"}
              title="Acak"
            >
              <IconShuffle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ds-pbtn"
              onClick={cycleRepeat}
              data-active={repeat && repeat !== "off" ? "1" : undefined}
              aria-pressed={!!(repeat && repeat !== "off")}
              aria-label="Ubah mode ulangi"
              title="Ulangi"
            >
              {repeat === "one" ? (
                <IconRepeatOne className="h-4 w-4" />
              ) : (
                <IconRepeat className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              className="ds-pbtn"
              onClick={toggleAutoplay}
              data-active={autoplay ? "1" : undefined}
              aria-pressed={!!autoplay}
              aria-label={autoplay ? "Matikan AutoPlay" : "Aktifkan AutoPlay"}
              title="AutoPlay"
            >
              <IconInfinity className="h-4 w-4" />
            </button>
          </LiquidGlass>

          <div className="flex items-center gap-1.5">
            <span className="ds-rpill">{list.length} item</span>
            <button
              type="button"
              className="ds-pbtn"
              onClick={onClose}
              aria-label="Tutup panel kanan"
              title="Tutup"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mode === "lyrics" ? (
          <div className="min-h-0 flex-1 overflow-hidden p-3">
            <LyricsPanel />
          </div>
        ) : (
          <div className="ds-right-scroll">
            <div>
              <h2 className="ds-np-label">Now Playing</h2>
              {current ? (
                <button
                  type="button"
                  className="ds-np-card"
                  onClick={onOpenImmersive}
                  title="Buka mode imersif"
                >
                  {current.thumbs ? (
                    <img
                      src={current.thumbs}
                      alt=""
                      width="42"
                      height="42"
                      className="ds-np-art"
                    />
                  ) : (
                    <span className="ds-np-art flex items-center justify-center">
                      <IconMusic className="h-4 w-4 text-white/50" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[#f3efec]">
                      {current.title || "Lagu tanpa judul"}
                    </span>
                    {curSub && (
                      <span className="block truncate text-[11.5px] text-[#a9a3a0]">
                        {curSub}
                      </span>
                    )}
                  </span>
                </button>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12.5px] leading-relaxed text-[#a9a3a0]">
                  Belum ada lagu diputar. Pilih lagu di Beranda atau Cari untuk mulai memutar.
                </div>
              )}
            </div>

            <div>
              <div className="ds-next-head">
                <h2 className="ds-np-label m-0">Playing Next</h2>
                {list.length > 0 && (
                  <span className="ds-next-sub">
                    {Math.max(1, index + 1)} dari {list.length}
                  </span>
                )}
              </div>

              {upcoming.length === 0 ? (
                <p className="py-4 text-[12.5px] text-[#a9a3a0]">
                  Tidak ada lagu berikutnya di antrean.
                </p>
              ) : (
                <div className="ds-q-list">
                  {upcoming.map(({ track, realIndex }) => {
                    const isCur = realIndex === index;
                    const artist = track.artist || track.artists?.[0] || "Artis tidak diketahui";
                    const sub = [artist, track.album].filter(Boolean).join(" · ");
                    return (
                      <div
                        key={`${track.videoId}-${realIndex}`}
                        className="ds-q-row"
                        data-current={isCur ? "1" : undefined}
                      >
                        <button
                          type="button"
                          className="ds-q-play"
                          onClick={() => jumpTo(realIndex)}
                          aria-current={isCur ? "true" : undefined}
                        >
                          <span className="ds-q-num">{realIndex + 1}</span>
                          {track.thumbs ? (
                            <img
                              src={track.thumbs}
                              alt=""
                              width="36"
                              height="36"
                              className="ds-q-thumb"
                              loading="lazy"
                            />
                          ) : (
                            <span className="ds-q-thumb flex items-center justify-center">
                              <IconMusic className="h-3.5 w-3.5 text-white/50" />
                            </span>
                          )}
                          <span className="ds-q-meta">
                            <span className="ds-q-title">{track.title || "Lagu tanpa judul"}</span>
                            <span className="ds-q-artist">{sub}</span>
                          </span>
                        </button>
                        {!isCur && (
                          <button
                            type="button"
                            className="ds-q-rm"
                            onClick={() => removeFromQueue(realIndex)}
                            aria-label={`Hapus ${track.title || "lagu"} dari antrean`}
                            title="Hapus dari antrean"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ds-right-foot">
          <button
            type="button"
            className="ds-auto-btn"
            onClick={toggleAutoplay}
            data-active={autoplay ? "1" : undefined}
            aria-pressed={!!autoplay}
          >
            <IconInfinity className="h-3.5 w-3.5" />
            <span>AutoPlay</span>
          </button>
          <span className="ds-foot-meta">{remText || `${list.length} lagu`}</span>
        </div>
      </aside>
    </>
  );
}
