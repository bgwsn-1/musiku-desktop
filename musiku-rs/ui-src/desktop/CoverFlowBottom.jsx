// Bar bawah Cover Flow: progress penuh + kontrol player di tengah.
// Judul/artis/badge hanya muncul di bawah cover aktif (CoverItem).
import { ImmersiveProgressBar } from "./ImmersiveProgressBar";
import { CoverFlowControls } from "./CoverFlowControls";
import { CF_FX } from "./coverFlowMath";

export function CoverFlowBottom() {
  return (
    <div className="cf-bottom">
      <ImmersiveProgressBar smoothReset resetMs={CF_FX.progressResetMs} />
      <div className="cf-bottom-row">
        <CoverFlowControls />
      </div>
    </div>
  );
}
