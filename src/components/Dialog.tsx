"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modal: centered glass dialog on desktop, bottom sheet on phones.
 * One short task, an obvious way out (Esc, scrim, Cancel), focus is trapped
 * and returned to the trigger (modality.md, sheets.md).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !mounted) return;
    const el = panel.current;
    if (!el) return;
    const last = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => !n.hasAttribute("disabled"));
    (el.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      last?.focus?.();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;
  return createPortal(
    // portal events still bubble through React ancestors (e.g. a clickable row)
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-center"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="scrim-in absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="dialog-in glass glass-lg relative w-full max-w-[420px] rounded-t-[28px] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] outline-none md:rounded-[26px] md:pb-5"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--track)] md:hidden" aria-hidden="true" />
        <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-label1">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function NewPlaylistDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!open) setName("");
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="Playlist baru">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name.trim());
        }}
      >
        <input
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama playlist"
          maxLength={80}
          aria-label="Nama playlist"
          className="h-11 w-full rounded-xl bg-fill1 px-4 text-[15px] text-label1 outline-none placeholder:text-label3 focus:bg-fill2 focus:ring-2 focus:ring-accent"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-quiet">
            Batal
          </button>
          <button type="submit" disabled={!name.trim()} className="btn btn-primary">
            Buat
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Destructive, irreversible → say what is lost; Cancel is the default focus. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-[15px] leading-snug text-label2">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button data-autofocus type="button" onClick={onClose} className="btn btn-quiet">
          Batal
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="btn btn-primary"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
