// Halaman Pengaturan desktop 1:1 mengikuti YesPlayMusic (lib/pages/settings.dart):
// - Judul besar ArchivoWide 44px + navigasi kiri 200px (Umum, Pintasan, Tentang)
// - Tab Umum: layout 2 kolom kartu (Tampilan/Aksen warna, Integrasi & Data, Pemutaran Crossfade/Autoplay/Volume)
// - Tab Pintasan: layout 2 kolom dengan tombol keycap (Pemutaran & Antarmuka)
// - Tab Tentang: info aplikasi Musiku + Pemeriksa & Pemasang Pembaruan nyata (/api/update/check & /install)
import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import {
  IconKeyboard,
  IconMusic,
  IconVolume,
  IconVolumeMute,
} from "@/components/Icons";
import { useAccount } from "./CloudAccountContext.jsx";
import { AccountModal } from "./AccountModal.jsx";
import {
  ACCENT_SWATCHES,
  applyAccentById,
  readAccentId,
} from "./accentTheme.js";
import {
  readDiscordRpcEnabled,
  setDiscordRpcEnabled,
} from "./DiscordPresence.jsx";

const CF_PRESETS = [2, 4, 6, 8, 10, 12];

function IconGear({ className = "h-5 w-5" }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconInfo({ className = "h-5 w-5" }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`ypm-switch ${checked ? "is-on" : ""}`}
    >
      <span className="ypm-switch-thumb" />
    </button>
  );
}

const SHORTCUTS_PLAYBACK = [
  { label: "Putar / Jeda", keys: ["Space"] },
  { label: "Lagu berikutnya / geser maju", keys: ["Right"] },
  { label: "Lagu sebelumnya / geser mundur", keys: ["Left"] },
  { label: "Bisukan / aktifkan suara", keys: ["M"] },
  { label: "Aktifkan / matikan acak", keys: ["S"] },
  { label: "Ganti mode ulangi", keys: ["R"] },
];

const SHORTCUTS_UI = [
  { label: "Buka layar Now Playing", keys: ["F"] },
  { label: "Buka / tutup panel Lirik", keys: ["Y"] },
  { label: "Buka / tutup panel Antrean", keys: ["Q"] },
  { label: "Tutup layar penuh / dialog", keys: ["Esc"] },
];

export function DesktopSettingsPage() {
  const player = usePlayer();
  const account = useAccount();

  const [nav, setNav] = useState("general");
  const [accentId, setAccentId] = useState(() => readAccentId());
  const [rpcOn, setRpcOn] = useState(() => readDiscordRpcEnabled());
  const [accountOpen, setAccountOpen] = useState(false);

  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateErr, setUpdateErr] = useState(null);

  const handleAccent = (id) => {
    setAccentId(id);
    const sw = applyAccentById(id);
    toast(`Warna aksen diubah ke ${sw.name}`);
  };

  const handleToggleRpc = (nextVal) => {
    setRpcOn(nextVal);
    setDiscordRpcEnabled(nextVal);
    toast(
      nextVal
        ? "Discord Rich Presence diaktifkan"
        : "Discord Rich Presence dinonaktifkan"
    );
  };

  const handleClearSearch = () => {
    try {
      window.localStorage.removeItem("musiku.search.queries");
      window.localStorage.removeItem("musiku.search.hits");
      toast("Riwayat pencarian dibersihkan");
    } catch {
      toast("Gagal membersihkan riwayat");
    }
  };

  const checkUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateErr(null);
    try {
      const r = await fetch("/api/update/check");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setUpdateInfo(d);
    } catch (e) {
      setUpdateErr(String(e));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    setInstallingUpdate(true);
    setUpdateErr(null);
    try {
      const r = await fetch("/api/update/install", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      toast("Pembaruan diunduh dan sedang dipasang");
    } catch (e) {
      setUpdateErr(String(e));
      toast("Gagal memasang pembaruan otomatis");
    } finally {
      setInstallingUpdate(false);
    }
  };

  useEffect(() => {
    if (nav === "about" && !updateInfo && !checkingUpdate) {
      void checkUpdates();
    }
  }, [nav]);

  const volPct = Math.round((player.muted ? 0 : player.volume) * 100);

  return (
    <div className="ypm-set">
      <h1 className="ypm-set-heading">Pengaturan</h1>

      <div className="ypm-set-layout">
        {/* Sidebar Kategori Kiri 200px (YesPlayMusic SettingsPage) */}
        <nav className="ypm-set-nav" aria-label="Kategori pengaturan">
          {[
            { id: "general", label: "Umum", icon: IconGear },
            { id: "shortcuts", label: "Pintasan", icon: IconKeyboard },
            { id: "about", label: "Tentang", icon: IconInfo },
          ].map((item) => {
            const Icon = item.icon;
            const active = nav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setNav(item.id)}
                aria-current={active ? "page" : undefined}
                className={`ypm-set-nav-btn ${active ? "is-active" : ""}`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Area Konten Kanan */}
        <div className="ypm-set-content">
          {nav === "general" && (
            <div className="ypm-set-cols">
              {/* Kolom Kiri: Tampilan & Integrasi */}
              <div className="ypm-set-col">
                <section className="ypm-set-sec">
                  <h2 className="ypm-set-sec-title">Tampilan</h2>
                  <div className="ypm-set-card">
                    <div className="ypm-set-row ypm-set-row-col">
                      <div className="ypm-set-row-text">
                        <p className="ypm-set-label">Warna Aksen</p>
                        <p className="ypm-set-desc">
                          Dipakai untuk tombol utama, indikator aktif, dan fokus.
                        </p>
                      </div>
                      <div className="ypm-swatch-row">
                        {ACCENT_SWATCHES.map((sw) => (
                          <button
                            key={sw.id}
                            type="button"
                            onClick={() => handleAccent(sw.id)}
                            aria-label={`Warna aksen ${sw.name}`}
                            aria-pressed={accentId === sw.id}
                            title={sw.name}
                            className={`ypm-swatch ${accentId === sw.id ? "is-active" : ""}`}
                            style={{ backgroundColor: sw.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="ypm-set-sec">
                  <h2 className="ypm-set-sec-title">Integrasi & Data</h2>
                  <div className="ypm-set-card">
                    <div className="ypm-set-row">
                      <div className="ypm-set-row-text">
                        <p className="ypm-set-label">Discord Rich Presence</p>
                        <p className="ypm-set-desc">
                          Tampilkan lagu yang sedang diputar di profil Discord.
                        </p>
                      </div>
                      <Switch
                        checked={rpcOn}
                        onChange={handleToggleRpc}
                        label="Discord Rich Presence"
                      />
                    </div>

                    <div className="ypm-set-rule" />

                    <div className="ypm-set-row">
                      <div className="ypm-set-row-text">
                        <p className="ypm-set-label">Akun & Cloud Sync</p>
                        <p className="ypm-set-desc">
                          {account.user
                            ? `${account.displayName || account.user.email} (${account.syncStatus === "synced" ? "Tersinkron" : "Terhubung"})`
                            : "Mode lokal perangkat ini"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAccountOpen(true)}
                        className="ypm-pill ypm-pill-ghost ypm-pill-sm"
                      >
                        {account.user ? "Kelola" : "Masuk"}
                      </button>
                    </div>

                    <div className="ypm-set-rule" />

                    <div className="ypm-set-row">
                      <div className="ypm-set-row-text">
                        <p className="ypm-set-label">Riwayat Pencarian</p>
                        <p className="ypm-set-desc">
                          Hapus kata kunci dan item baru dibuka dari perangkat.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="ypm-pill ypm-pill-ghost ypm-pill-sm"
                      >
                        Bersihkan
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Kolom Kanan: Pemutaran */}
              <div className="ypm-set-col">
                <section className="ypm-set-sec">
                  <h2 className="ypm-set-sec-title">Pemutaran</h2>
                  <div className="ypm-set-card">
                    <div className="ypm-set-row">
                      <div className="ypm-set-row-text">
                        <p className="ypm-set-label">Crossfade Antar Lagu</p>
                        <p className="ypm-set-desc">
                          Memudarkan peralihan ke lagu berikutnya secara halus.
                        </p>
                      </div>
                      <Switch
                        checked={Boolean(player.crossfade)}
                        onChange={() => player.toggleCrossfade?.()}
                        label="Crossfade antar lagu"
                      />
                    </div>

                    <div className="ypm-set-rule" />

                    <div className="ypm-set-row ypm-set-row-col">
                      <div className="ypm-set-row-text">
                        <p className="ypm-set-label">
                          Durasi Crossfade ({player.cfSec || 4} detik)
                        </p>
                        <p className="ypm-set-desc">
                          Panjang transisi saat Crossfade aktif.
                        </p>
                      </div>
                      <div className="ypm-seg-choices">
                        {CF_PRESETS.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            disabled={!player.crossfade}
                            onClick={() => player.setCfSec?.(sec)}
                            className={`ypm-choice-pill ${player.cfSec === sec ? "is-active" : ""}`}
                          >
                            {sec} dtk
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ypm-set-rule" />

                    <div className="ypm-set-row">
                      <div className="ypm-set-row-text">
                        <p className="ypm-set-label">Putar Otomatis (Autoplay)</p>
                        <p className="ypm-set-desc">
                          Lanjutkan dengan lagu serupa saat antrean habis.
                        </p>
                      </div>
                      <Switch
                        checked={Boolean(player.autoplay)}
                        onChange={() => player.toggleAutoplay?.()}
                        label="Putar otomatis"
                      />
                    </div>

                    <div className="ypm-set-rule" />

                    <div className="ypm-set-row ypm-set-row-col">
                      <div className="ypm-set-row-head">
                        <p className="ypm-set-label">Volume Pemutar</p>
                        <span className="ypm-set-val">{volPct}%</span>
                      </div>
                      <div className="ypm-set-vol-line">
                        <button
                          type="button"
                          onClick={player.toggleMute}
                          aria-label={player.muted ? "Aktifkan suara" : "Bisukan suara"}
                          className="ypm-set-vol-btn"
                        >
                          {player.muted || player.volume === 0 ? (
                            <IconVolumeMute className="h-4 w-4" />
                          ) : (
                            <IconVolume className="h-4 w-4" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={player.muted ? 0 : player.volume}
                          onChange={(e) => player.setVolume(Number(e.target.value))}
                          aria-label="Volume pemutar"
                          className="ypm-set-range"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {nav === "shortcuts" && (
            <div className="ypm-set-cols">
              <div className="ypm-set-col">
                <section className="ypm-set-sec">
                  <h2 className="ypm-set-sec-title">Pemutaran</h2>
                  <div className="ypm-set-card">
                    {SHORTCUTS_PLAYBACK.map((s, i) => (
                      <div key={s.label}>
                        {i > 0 && <div className="ypm-set-rule" />}
                        <div className="ypm-set-row ypm-set-row-compact">
                          <span className="ypm-set-label">{s.label}</span>
                          <div className="ypm-keys">
                            {s.keys.map((k) => (
                              <kbd key={k} className="ypm-keycap">
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="ypm-set-col">
                <section className="ypm-set-sec">
                  <h2 className="ypm-set-sec-title">Antarmuka</h2>
                  <div className="ypm-set-card">
                    {SHORTCUTS_UI.map((s, i) => (
                      <div key={s.label}>
                        {i > 0 && <div className="ypm-set-rule" />}
                        <div className="ypm-set-row ypm-set-row-compact">
                          <span className="ypm-set-label">{s.label}</span>
                          <div className="ypm-keys">
                            {s.keys.map((k) => (
                              <kbd key={k} className="ypm-keycap">
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="ypm-set-hint">
                    Pintasan dinonaktifkan otomatis saat kursor sedang mengetik di kolom input.
                  </p>
                </section>
              </div>
            </div>
          )}

          {nav === "about" && (
            <div className="ypm-set-about">
              <div className="ypm-set-card ypm-about-hero">
                <div className="ypm-about-logo">
                  <IconMusic className="h-8 w-8" />
                </div>
                <div className="ypm-about-meta">
                  <h2 className="ypm-about-name">Musiku Desktop</h2>
                  <p className="ypm-about-ver">
                    Versi {updateInfo?.current || "0.2.0"} · Rust & Tauri
                  </p>
                  <p className="ypm-set-desc" style={{ marginTop: 6 }}>
                    Pemutar musik desktop ringan dengan Record Shelf, lirik sinkron, Cover Flow 3D, Apple Motion Art, dan Cloud Sync.
                  </p>
                </div>
              </div>

              <section className="ypm-set-sec">
                <h2 className="ypm-set-sec-title">Pembaruan Aplikasi</h2>
                <div className="ypm-set-card">
                  <div className="ypm-set-row">
                    <div className="ypm-set-row-text">
                      <p className="ypm-set-label">
                        {checkingUpdate
                          ? "Memeriksa pembaruan..."
                          : updateInfo?.updateAvailable
                            ? `Versi baru tersedia: v${updateInfo.latest}`
                            : updateInfo
                              ? `Sudah menggunakan versi terbaru (v${updateInfo.current})`
                              : "Status pembaruan"}
                      </p>
                      {updateErr && (
                        <p className="ypm-set-desc" style={{ color: "#ff5c7a" }}>
                          {updateErr}
                        </p>
                      )}
                      {updateInfo?.publishedAt && (
                        <p className="ypm-set-desc">
                          Dirilis: {updateInfo.publishedAt.slice(0, 10)}
                        </p>
                      )}
                    </div>

                    <div className="ypm-set-upd-acts">
                      {updateInfo?.updateAvailable && (
                        <button
                          type="button"
                          disabled={installingUpdate}
                          onClick={installUpdate}
                          className="ypm-pill ypm-pill-primary ypm-pill-sm"
                        >
                          {installingUpdate ? "Memasang..." : "Pasang Pembaruan"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={checkingUpdate}
                        onClick={checkUpdates}
                        className="ypm-pill ypm-pill-ghost ypm-pill-sm"
                      >
                        {checkingUpdate ? "Memeriksa..." : "Periksa Ulang"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
