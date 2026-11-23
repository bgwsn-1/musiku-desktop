"use client";

/**
 * Cover Flow hanya untuk klien desktop (Windows/Linux). Web dan Android
 * sengaja tidak merender apa pun; bundle desktop mengganti modul ini lewat
 * alias di `musiku-rs/ui-src/build.mjs`.
 */
export function CoverFlow(_props: { onExit?: () => void }) {
  return null;
}
