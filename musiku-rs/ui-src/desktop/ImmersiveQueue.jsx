// Daftar antrean di dalam kartu kanan mode imersif.
import { usePlayer } from "@/lib/player";
import { IconMusic, IconTrash } from "@/components/Icons";

export function ImmersiveQueue() {
  const { queue, index, jumpTo, removeFromQueue } = usePlayer();
  const list = Array.isArray(queue) ? queue : [];

  return (
    <div className="im-queue" role="region" aria-label="Antrean lagu">
      <div className="im-queue-head">
        <h2 className="im-queue-title">Antrean</h2>
        <span className="im-queue-count">{list.length} lagu</span>
      </div>

      {list.length === 0 ? (
        <div className="im-queue-empty">
          <p>Antrean masih kosong. Putar lagu atau album untuk mengisi daftar berikutnya.</p>
        </div>
      ) : (
        <div className="im-queue-list">
          {list.map((item, i) => {
            const isCur = i === index;
            const artist = item.artist || item.artists?.[0] || "Artis tidak diketahui";
            return (
              <div
                key={`${item.videoId}-${i}`}
                className="im-queue-row"
                data-current={isCur ? "1" : undefined}
              >
                <button
                  type="button"
                  className="im-queue-play"
                  onClick={() => jumpTo(i)}
                  aria-current={isCur ? "true" : undefined}
                >
                  {item.thumbs ? (
                    <img
                      src={item.thumbs}
                      alt=""
                      width="40"
                      height="40"
                      className="im-queue-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <span className="im-queue-thumb flex items-center justify-center">
                      <IconMusic className="h-4 w-4 text-white/50" />
                    </span>
                  )}
                  <span className="im-queue-meta">
                    <span className="im-queue-name">{item.title || "Lagu tanpa judul"}</span>
                    <span className="im-queue-sub">{artist}</span>
                  </span>
                </button>
                {!isCur && (
                  <button
                    type="button"
                    className="im-queue-rm"
                    onClick={() => removeFromQueue(i)}
                    aria-label={`Hapus ${item.title || "lagu"} dari antrean`}
                    title="Hapus dari antrean"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
