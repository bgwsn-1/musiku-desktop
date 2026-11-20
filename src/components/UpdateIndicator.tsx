"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";

type UpdateAsset = {
  name: string;
  size: number;
  url: string;
  digest: string | null;
};

type UpdateInfo = {
  current: string;
  latest: string;
  updateAvailable: boolean;
  notes: string;
  url: string;
  publishedAt: string;
  assets: UpdateAsset[];
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

const invoke = (cmd: string, args?: Record<string, unknown>) =>
  window.__TAURI_INTERNALS__?.invoke?.(cmd, args);

async function openExternal(url: string) {
  try {
    await invoke("open_external", { url });
    return;
  } catch {
    /* fallback untuk browser biasa */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Entri pembaruan di bawah sidebar. Hanya dipakai shell Tauri; di web
 *  (Next.js) endpoint /api/update/check tidak ada, jadi komponen ini hilang. */
export function UpdateIndicator() {
  const [desktop, setDesktop] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDesktop(Boolean(window.__TAURI_INTERNALS__));
  }, []);

  useEffect(() => {
    if (!desktop) return;
    let live = true;
    const timer = setTimeout(() => {
      fetch("/api/update/check")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: UpdateInfo | null) => live && setInfo(j))
        .catch(() => {});
    }, 1200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [desktop]);

  if (!desktop) return null;

  const install = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/update/install", { method: "POST" });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Unduhan gagal");
      await invoke("quit_app");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-2 shrink-0 border-t border-white/10 pt-2">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-label3 transition-colors hover:bg-fill1 hover:text-label1"
          aria-label="Cek pembaruan Musiku"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${info?.updateAvailable ? "bg-accent" : "bg-label3/40"}`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">
            Musiku {info?.current ?? "…"}
          </span>
          {info?.updateAvailable && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-window">
              Baru
            </span>
          )}
        </button>
      </div>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} title="Pembaruan Musiku">
        <div className="space-y-3">
          {!info && <p className="text-[14px] text-label2">Memeriksa pembaruan…</p>}

          {info && !info.updateAvailable && (
            <p className="text-[14px] text-label2">
              Versi {info.current} sudah yang terbaru.
            </p>
          )}

          {info?.updateAvailable && (
            <>
              <p className="text-[15px] font-semibold text-label1">
                Musiku {info.latest} tersedia
              </p>
              <p className="text-[13px] text-label2">Versi terpasang: {info.current}</p>
              {info.notes && (
                <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-fill1 p-3 text-[12px] leading-relaxed text-label2">
                  {info.notes}
                </pre>
              )}
              {error && <p className="text-[13px] text-red-400">{error}</p>}
              <p className="text-[12px] leading-snug text-label3">
                Windows: installer dipasang otomatis. Linux: file .deb diunduh lalu dibuka
                dengan package manager.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={install}
                  disabled={busy}
                  className="glass-btn rounded-full px-4 py-2 text-[13px] font-semibold text-label1 disabled:opacity-50"
                >
                  {busy ? "Mengunduh…" : "Unduh & pasang"}
                </button>
                <button
                  onClick={() => openExternal(info.url)}
                  className="rounded-full px-4 py-2 text-[13px] font-semibold text-label2 hover:bg-fill1 hover:text-label1"
                >
                  Buka di GitHub
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
