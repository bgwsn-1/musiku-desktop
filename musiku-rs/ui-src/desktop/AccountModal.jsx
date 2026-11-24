// Modal akun Supabase: Masuk, Daftar, ubah Nama Tampilan, dan status sinkronisasi cloud.
import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import { IconClose } from "@/components/Icons";
import { useAccount } from "./CloudAccountContext.jsx";

function formatSyncTime(date) {
  if (!date) return "Belum disinkronkan";
  try {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Baru saja";
  }
}

export function AccountModal({ onClose }) {
  const account = useAccount();
  const { liked, playlists } = usePlayer();

  const [tab, setTab] = useState("login");
  const [displayNameInput, setDisplayNameInput] = useState(() => account.displayName || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  useEffect(() => {
    if (account.user) {
      setDisplayNameInput(account.displayName || "");
    }
  }, [account.user, account.displayName]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrMsg("");
    setInfoMsg("");
    setBusy(true);
    try {
      if (tab === "login") {
        await account.signIn({ email, password });
        toast("Berhasil masuk ke akun Musiku");
        onClose();
      } else {
        const res = await account.signUp({
          email,
          password,
          displayName: displayNameInput,
        });
        if (res.needsEmailConfirm) {
          setInfoMsg(
            "Akun dibuat. Cek kotak masuk email kamu untuk mengonfirmasi pendaftaran sebelum masuk.",
          );
          setTab("login");
        } else {
          toast("Akun dibuat dan langsung terhubung");
          onClose();
        }
      }
    } catch (err) {
      setErrMsg(err?.message || "Autentikasi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setErrMsg("");
    setInfoMsg("");
    setBusy(true);
    try {
      await account.updateProfile({ displayName: displayNameInput });
      toast("Profil diperbarui");
    } catch (err) {
      setErrMsg(err?.message || "Gagal memperbarui profil.");
    } finally {
      setBusy(false);
    }
  };

  const handleManualSync = async () => {
    setErrMsg("");
    setBusy(true);
    try {
      await account.requestSync();
      toast("Pustaka disinkronkan ke cloud");
    } catch (err) {
      setErrMsg(err?.message || "Sinkronisasi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await account.signOut();
      toast("Keluar dari akun. Pustaka lokal tetap tersimpan.");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const initial = (account.displayName || account.user?.email || "M").slice(0, 1).toUpperCase();

  return (
    <div
      className="ds-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-label={account.user ? "Profil dan Sinkronisasi Cloud" : "Masuk atau Daftar Akun"}
      onClick={onClose}
    >
      <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold text-[#f6efe9]">
            {account.user ? "Akun & Sinkronisasi" : "Akun Musiku"}
          </h2>
          <button
            type="button"
            className="ds-sec-add"
            onClick={onClose}
            aria-label="Tutup dialog akun"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {!account.configured ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[#b5aeaa]">
            Konfigurasi Supabase belum diisi. Data tetap disimpan secara lokal di perangkat ini.
          </p>
        ) : account.user ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <span className="ds-account-avatar h-10 w-10 text-[15px]" aria-hidden="true">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-[#f6efe9]">
                  {account.displayName || "Pengguna Musiku"}
                </p>
                <p className="truncate text-[12px] text-[#b5aeaa]">{account.user.email}</p>
              </div>
            </div>

            <form onSubmit={handleProfileSave}>
              <label
                htmlFor="ds-profile-display-name"
                className="block text-[12px] font-semibold text-[#d6ccc7]"
              >
                Nama Tampilan
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="ds-profile-display-name"
                  type="text"
                  maxLength={60}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Nama tampilan"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-[13.5px] text-[#f3efec] outline-none focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={busy || !displayNameInput.trim()}
                  className="cursor-pointer rounded-xl bg-[#e3a28c] px-4 text-[13px] font-bold text-[#151010] hover:bg-[#edb39f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Simpan
                </button>
              </div>
            </form>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-[#f3efec]">
                  Status Cloud Sync
                </span>
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#d6ccc7]">
                  <span className="ds-account-dot" data-state={account.syncStatus} />
                  {account.syncStatus === "syncing"
                    ? "Menyinkronkan..."
                    : account.syncStatus === "error"
                      ? "Gagal sinkron"
                      : account.syncStatus === "synced"
                        ? `Tersinkron (${formatSyncTime(account.lastSyncedAt)})`
                        : "Siap"}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-[#b5aeaa]">
                {Array.isArray(liked) ? liked.length : 0} lagu disukai ·{" "}
                {Array.isArray(playlists) ? playlists.length : 0} playlist tersimpan otomatis ke
                akun kamu.
              </p>
              {account.syncError && <p className="ds-auth-err mt-2">{account.syncError}</p>}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={busy || account.syncStatus === "syncing"}
                className="mt-3 w-full cursor-pointer rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-[#f6efe9] hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {account.syncStatus === "syncing" ? "Menyinkronkan..." : "Sinkronkan Sekarang"}
              </button>
            </div>

            {errMsg && <p className="ds-auth-err">{errMsg}</p>}

            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <span className="text-[11.5px] text-[#a9a3a0]">
                Data lokal tetap aman di perangkat saat keluar.
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="shrink-0 cursor-pointer rounded-xl border border-white/15 px-3.5 py-2 text-[12.5px] font-semibold text-[#ffb4ab] hover:bg-white/10 disabled:opacity-45"
              >
                Keluar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[12.5px] leading-relaxed text-[#b5aeaa]">
              Masuk untuk menyimpan lagu disukai, playlist, dan riwayat putar ke akun Supabase kamu.
            </p>

            <div className="ds-auth-tabs mt-3" role="tablist" aria-label="Mode autentikasi">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "login"}
                className="ds-auth-tab"
                data-active={tab === "login" ? "1" : undefined}
                onClick={() => {
                  setTab("login");
                  setErrMsg("");
                }}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "signup"}
                className="ds-auth-tab"
                data-active={tab === "signup" ? "1" : undefined}
                onClick={() => {
                  setTab("signup");
                  setErrMsg("");
                }}
              >
                Daftar
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-3 space-y-3">
              {tab === "signup" && (
                <div>
                  <label
                    htmlFor="ds-auth-name"
                    className="block text-[12px] font-semibold text-[#d6ccc7]"
                  >
                    Nama Tampilan
                  </label>
                  <input
                    id="ds-auth-name"
                    type="text"
                    maxLength={60}
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Mis. Elijah"
                    className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-[13.5px] text-[#f3efec] outline-none focus:border-white/40"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="ds-auth-email"
                  className="block text-[12px] font-semibold text-[#d6ccc7]"
                >
                  Email
                </label>
                <input
                  id="ds-auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-[13.5px] text-[#f3efec] outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label
                  htmlFor="ds-auth-password"
                  className="block text-[12px] font-semibold text-[#d6ccc7]"
                >
                  Kata Sandi
                </label>
                <input
                  id="ds-auth-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-[13.5px] text-[#f3efec] outline-none focus:border-white/40"
                />
              </div>

              {errMsg && <p className="ds-auth-err">{errMsg}</p>}
              {infoMsg && <p className="ds-auth-info">{infoMsg}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 h-10 w-full cursor-pointer rounded-xl bg-[#e3a28c] text-[13.5px] font-bold text-[#151010] hover:bg-[#edb39f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? "Memproses..."
                  : tab === "login"
                    ? "Masuk & Sinkronkan"
                    : "Buat Akun"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
