"use client";

import type { Track } from "@/lib/types";
import { toast } from "@/components/Toast";

/**
 * Kartu "sedang memutar" yang bisa dibagikan: kanvas 1200×1200 berisi sampul,
 * judul, artis, dan garis progres — lalu dikirim lewat Web Share API. Kalau
 * target tak mendukung berkas, kartu diunduh sebagai PNG.
 */

const W = 1200;
const H = 1200;

function loadImg(src: string): Promise<HTMLImageElement | null> {
  // gambar lewat proxy same-origin: kanvas tidak akan ter-taint
  const proxied = `/api/artwork-proxy?url=${encodeURIComponent(src)}`;
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = proxied;
  });
}

async function buildBlob(t: Track, progress: number): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const img = t.thumbs ? await loadImg(t.thumbs) : null;

  // latar: sampul diperbesar-dikaburkan + tirai gelap; tanpa sampul → gelap polos
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, W, H);
  if (img) {
    try {
      ctx.save();
      ctx.filter = "blur(64px) saturate(1.3)";
      const s = Math.max(W / img.width, H / img.height) * 1.25;
      ctx.drawImage(
        img,
        W / 2 - (img.width * s) / 2,
        H / 2 - (img.height * s) / 2,
        img.width * s,
        img.height * s,
      );
      ctx.restore();
      ctx.fillStyle = "rgba(10,10,13,0.72)";
      ctx.fillRect(0, 0, W, H);
    } catch {
      ctx.fillStyle = "#0b0b0d";
      ctx.fillRect(0, 0, W, H);
    }
  }

  // sampul utama
  const SIZE = 720;
  const x = (W - SIZE) / 2;
  const y = 170;
  if (img) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 24;
    ctx.beginPath();
    ctx.roundRect(x, y, SIZE, SIZE, 36);
    ctx.clip();
    ctx.drawImage(img, x, y, SIZE, SIZE);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(x, y, SIZE, SIZE, 36);
    ctx.fill();
  }

  // judul & artis
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 62px -apple-system, 'Segoe UI', Roboto, sans-serif";
  let title = t.title;
  while (ctx.measureText(title).width > W - 160 && title.length > 4) title = title.slice(0, -2);
  if (title !== t.title) title += "…";
  ctx.fillText(title, W / 2, y + SIZE + 110);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "400 40px -apple-system, 'Segoe UI', Roboto, sans-serif";
  let artist = t.artist ?? "";
  while (ctx.measureText(artist).width > W - 200 && artist.length > 4) artist = artist.slice(0, -2);
  if (artist && artist !== (t.artist ?? "")) artist += "…";
  ctx.fillText(artist, W / 2, y + SIZE + 175);

  // garis progres
  const barW = W - 260;
  const barY = y + SIZE + 252;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.roundRect(W / 2 - barW / 2, barY, barW, 6, 3);
  ctx.fill();
  const k = Math.min(Math.max(progress, 0), 1);
  if (k > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(W / 2 - barW / 2, barY, Math.max(barW * k, 6), 6, 3);
    ctx.fill();
  }

  // tanda aplikasi
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 30px -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.letterSpacing = "10px";
  ctx.fillText("MUSIKU", W / 2, barY + 84);
  ctx.letterSpacing = "0px";

  try {
    return await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  } catch {
    return null; // kanvas ter-taint (CORS)
  }
}

export async function shareTrack(t: Track, progress = 0) {
  const text = t.artist ? `${t.title} — ${t.artist}` : t.title;
  const blob = await buildBlob(t, progress);
  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean;
  };
  const file = blob ? new File([blob], "musiku.png", { type: "image/png" }) : null;
  if (file && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t.title, text });
      return; // sukses — jangan bunyikan toast, sheet share sudah jadi umpan balik
    } catch {
      return; // user membatalkan
    }
  }
  if (file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `musiku-${t.videoId}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    toast("Kartu lagu diunduh");
    return;
  }
  try {
    await navigator.share({ title: t.title, text });
  } catch {
    toast("Kartu lagu gagal dibuat");
  }
}
