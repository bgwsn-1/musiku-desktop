// Kontrol player imersif: hanya komponen ini yang re-render saat play/pause.
import { memo } from "react";
import { usePlayer } from "@/lib/player";
import { IconNext, IconPause, IconPlay, IconPrev } from "@/components/Icons";

export const ImmersiveControls = memo(function ImmersiveControls() {
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
        {playing ? <IconPause className="h-6 w-6" /> : <IconPlay className="h-6 w-6" />}
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
});
