"use client";

import { Dialog } from "@/components/Dialog";

const kbd =
  "inline-flex min-w-[22px] items-center justify-center rounded-md bg-fill1 px-1.5 py-0.5 text-center text-[12px] font-semibold text-label1 shadow-[0_1px_0_rgba(255,255,255,0.06)]";

/** Daftar pintasan global. Dipakai bar dan pemutar layar penuh. */
export function ShortcutHelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ["Spasi"], label: "Putar / jeda" },
    { keys: ["⇧", "→"], label: "Lagu berikutnya" },
    { keys: ["⇧", "←"], label: "Lagu sebelumnya" },
    { keys: ["→"], label: "Maju 5 detik" },
    { keys: ["←"], label: "Mundur 5 detik" },
    { keys: ["F"], label: "Layar penuh" },
    { keys: ["L"], label: "Favorit" },
    { keys: ["M"], label: "Bisukan suara" },
    { keys: ["Q"], label: "Antrian" },
    { keys: ["Y"], label: "Lirik" },
    { keys: ["S"], label: "Acak" },
    { keys: ["R"], label: "Ulangi" },
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Pintasan keyboard">
      <ul>
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] py-2 text-[14px] text-label2 last:border-b-0"
          >
            <span>{row.label}</span>
            <span className="flex shrink-0 gap-1">
              {row.keys.map((key, i) => (
                <kbd key={i} className={kbd}>
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-label3">
        Pintasan dilewati saat sedang mengetik atau saat dialog terbuka.
      </p>
    </Dialog>
  );
}
