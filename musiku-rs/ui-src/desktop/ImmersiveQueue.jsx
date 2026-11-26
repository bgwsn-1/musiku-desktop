// Daftar antrean di Playing Screen bergaya YesPlayMusic (_NpList / _NpRow):
// Label "Berikutnya" 13px ArchivoSemi, baris tinggi 65px, cover 45x45 r:8 dengan overlay Play saat hover,
// judul 15px w700 putih, artis 12px w600 putih 60%, durasi kanan, fade bawah tanpa scrollbar.
import { usePlayer } from "@/lib/player";
import { IconMusic, IconPlay, IconTrash } from "@/components/Icons";

export function ImmersiveQueue() {
  const { queue, index, jumpTo, removeFromQueue } = usePlayer();
  const list = Array.isArray(queue) ? queue : [];

  return (
    <div className="ypm-np-q" role="region" aria-label="Antrean lagu">
      <div className="ypm-np-q-head">
        <span className="ypm-np-q-label">Berikutnya</span>
        <span className="ypm-np-q-count">{list.length} lagu</span>
      </div>

      {list.length === 0 ? (
        <p className="ypm-np-q-empty">
          Antrean masih kosong. Putar lagu atau album untuk mengisi daftar berikutnya.
        </p>
      ) : (
        <div className="ypm-np-q-list">
          {list.map((item, i) => {
            const isCur = i === index;
            const artist = Array.isArray(item.artists)
              ? item.artists.filter(Boolean).join(", ")
              : item.artists || item.artist || "Artis tidak diketahui";
            const thumb = item.thumbs || item.thumb || null;
            return (
              <div
                key={`${item.videoId}-${i}`}
                className={`ypm-np-q-row ${isCur ? "is-cur" : ""}`}
              >
                <button
                  type="button"
                  className="ypm-np-q-btn"
                  onClick={() => jumpTo(i)}
                  aria-current={isCur ? "true" : undefined}
                >
                  <div className="ypm-np-q-art-wrap">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="ypm-np-q-art"
                        loading="lazy"
                      />
                    ) : (
                      <span className="ypm-np-q-art ypm-np-q-art-fb">
                        <IconMusic className="h-4 w-4" />
                      </span>
                    )}
                    <span className="ypm-np-q-play" aria-hidden="true">
                      <IconPlay className="h-5 w-5" />
                    </span>
                  </div>

                  <span className="ypm-np-q-meta">
                    <span className="ypm-np-q-name">
                      {item.title || "Lagu tanpa judul"}
                    </span>
                    <span className="ypm-np-q-sub">{artist}</span>
                  </span>

                  {item.duration && (
                    <span className="ypm-np-q-dur">{item.duration}</span>
                  )}
                </button>

                {!isCur && (
                  <button
                    type="button"
                    className="ypm-np-q-rm"
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
