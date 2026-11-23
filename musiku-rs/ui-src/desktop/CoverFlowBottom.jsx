// Bar bawah Cover Flow: pakai ulang progress bar & kontrol dari immersive.
import { usePlayer } from "@/lib/player";
import { ImmersiveProgressBar } from "./ImmersiveProgressBar";
import { ImmersiveControls } from "./ImmersiveControls";

export function CoverFlowBottom() {
  const { current } = usePlayer();
  return (
    <div className="cf-bottom">
      <ImmersiveProgressBar />
      <div className="cf-bottom-row">
        <span aria-hidden="true" />
        <div className="cf-now">
          <span className="cf-now-title">{current?.title || "Tidak ada lagu"}</span>
          <span className="cf-now-artist">{current?.artist || "—"}</span>
          <span className="im-badge" title="Audio dari YouTube Music (AAC/Opus)">
            LOSSY
          </span>
        </div>
        <ImmersiveControls />
      </div>
    </div>
  );
}
