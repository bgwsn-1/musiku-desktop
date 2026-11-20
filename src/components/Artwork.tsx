"use client";

import { useEffect, useState } from "react";
import { IconMusic } from "@/components/Icons";

/**
 * Sampul lagu/album. Sumber kosong atau gagal load → gradien lembut + ikon
 * musik — jadi nggak pernah ada kotak abu-abu kosong di mana pun.
 * `quiet` merender null saat fallback: dipakai di backdrop dekoratif.
 * `src` berganti (lagu ganti) → status gagal di-reset otomatis.
 */
export function Artwork({
  src,
  alt = "",
  className = "h-full w-full object-cover",
  eager = false,
  quiet = false,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  eager?: boolean;
  quiet?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    if (quiet) return null;
    return (
      <div
        aria-hidden="true"
        className={`${className} flex items-center justify-center bg-linear-to-b from-fill2 to-fill1`}
      >
        <IconMusic className="h-1/3 w-1/3 text-label3" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
