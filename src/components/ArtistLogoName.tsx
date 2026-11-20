"use client";

import { useEffect, useState } from "react";

/**
 * Nama artis di halaman artis: digantikan logo nama (wordmark) bila artis
 * punyanya (Wikidata P154 atau TheAudioDB). Gambar dilayani lewat proxy
 * same-origin /api/artist-logo/file, jadi canvas bisa mengukur luminance.
 * Logo gelap diubah jadi putih via filter, logo terang/berwarna apa adanya.
 * Tanpa logo → nama teks.
 */
export function ArtistLogoName({
  name,
  sizeClass = "max-h-[52px]",
}: {
  name: string;
  sizeClass?: string;
}) {
  const [logo, setLogo] = useState<string | null>(null);
  // sampai luminance-nya terukur, anggap gelap (jangan tampil hitam di latar hitam)
  const [dark, setDark] = useState(true);

  useEffect(() => {
    let alive = true;
    setLogo(null);
    setDark(true);
    fetch(`/api/artist-logo?name=${encodeURIComponent(name)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { url?: string | null } | null) => {
        // img selalu lewat proxy same-origin: canvas bisa baca pikselnya
        if (alive && d?.url) setLogo(`/api/artist-logo/file?name=${encodeURIComponent(name)}`);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name]);

  if (!logo) return <>{name}</>;

  return (
    <span className="inline-flex max-w-full items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={name}
        title={name}
        loading="eager"
        className={`${sizeClass} w-auto max-w-full object-contain ${
          dark ? "brightness-0 invert" : ""
        }`}
        onError={() => setLogo(null)} // proxy gagal → balik ke nama teks
        onLoad={(e) => {
          // logo gelap dibikin putih; logo terang/berwarna tampil langsung
          try {
            const img = e.currentTarget;
            const s = 64;
            const c = document.createElement("canvas");
            c.width = s;
            c.height = s;
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, s, s);
            const px = ctx.getImageData(0, 0, s, s).data;
            let lum = 0;
            let n = 0;
            for (let i = 0; i < px.length; i += 4) {
              if (px[i + 3] < 128) continue; // piksel transparan dilewati
              lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
              n++;
            }
            if (n > 0) setDark(lum / n < 120);
          } catch {
            /* canvas gagal → biarkan versi putih default */
          }
        }}
      />
    </span>
  );
}
