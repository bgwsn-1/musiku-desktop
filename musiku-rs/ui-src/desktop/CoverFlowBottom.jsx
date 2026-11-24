// Bar bawah Cover Flow: progress penuh + kontrol player di tengah.
// Judul/artis/badge hanya muncul di bawah cover aktif (CoverItem).
import { ImmersiveProgressBar } from "./ImmersiveProgressBar";
import { ImmersiveControls } from "./ImmersiveControls";

export function CoverFlowBottom() {
  return (
    <div className="cf-bottom">
      <ImmersiveProgressBar />
      <div className="cf-bottom-row">
        <ImmersiveControls />
      </div>
    </div>
  );
}
