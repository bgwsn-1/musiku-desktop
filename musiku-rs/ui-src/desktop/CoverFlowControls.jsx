// Kontrol bawah Cover Flow. Tombol memakai gaya .im-ctl yang sudah ada, tapi
// ikon play/pause punya transisi sendiri (scope .cf-*) tanpa menyentuh immersive.
import { usePlayer } from "@/lib/player";
import { IconNext, IconPause, IconPlay, IconPrev } from "@/components/Icons";

export function CoverFlowControls() {
  const { playing, toggle, next, prev } = usePlayer();
  return (
    <div className="im-controls">
      <button
        type="button"
        onClick={prev}
        className="im-ctl glass-btn"
        aria-label="Lagu sebelumnya"
        title="Lagu sebelumnya"
      >
        <IconPrev className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={toggle}
        className="im-ctl im-ctl-primary"
        aria-label={playing ? "Jeda" : "Putar"}
        title={playing ? "Jeda (Space)" : "Putar (Space)"}
      >
        <span className="cf-play-icon" key={playing ? "pause" : "play"}>
          {playing ? <IconPause className="h-6 w-6" /> : <IconPlay className="h-6 w-6" />}
        </span>
      </button>
      <button
        type="button"
        onClick={next}
        className="im-ctl glass-btn"
        aria-label="Lagu berikutnya"
        title="Lagu berikutnya"
      >
        <IconNext className="h-5 w-5" />
      </button>
    </div>
  );
}
