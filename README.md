# Musiku

Pemutar musik web: metadata dari YouTube Music, audio diputar lewat proxy
streaming, plus lirik sinkron dari LRCLIB.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- `ytmusic-api` untuk pencarian, beranda, album, artis, dan lirik YouTube Music
- `@distube/ytdl-core` untuk resolusi URL audio (pengganti `yt-dlp`/Python)

Semua backend sekarang berjalan di Node.js, jadi tidak butuh Python, venv, atau
binary eksternal saat deploy.

## Jalankan lokal

Butuh Node.js 24 (minimal 22.22.2, atau 24.15.0+).

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>.

## Deploy ke Vercel

1. Push folder ini ke repository GitHub/GitLab/Bitbucket.
2. Di [vercel.com](https://vercel.com) pilih **Add New → Project**, lalu import repo-nya.
3. Vercel otomatis mendeteksi **Next.js**. Biarkan semua setting default.
4. Klik **Deploy**.

Tidak ada environment variable yang wajib. Opsional:

| Variable | Default | Keterangan |
| --- | --- | --- |
| `YTM_GL` | `US` | Kode negara konten YouTube Music |
| `YTM_HL` | `en` | Kode bahasa metadata |

Catatan:

- Route `/api/stream/[id]` memakai `maxDuration = 300` dan `runtime = "nodejs"`.
  Di paket Hobby, durasi fungsi mengikuti batas akun (biasanya 300 detik dengan
  Fluid Compute).
- Jika YouTube membatasi IP datacenter, pencarian/streaming bisa gagal walau
  deploy-nya sukses. Coba lagi atau gunakan region Vercel yang berbeda.
- `scripts/scrape.py` adalah bridge Python lama dan tidak dipakai lagi oleh app.

## Dokumentasi

- `docs/DOKUMENTASI.md` — dokumentasi teknis lengkap (arsitektur, API, streaming, deployment)
- `docs/CATATAN-PRESENTASI.md` — cue card presentasi (±7 menit) + antisipasi tanya jawab
- `docs/DOKUMENTASI.pdf`, `docs/CATATAN-PRESENTASI.pdf` — versi cetak

Ubah `.md` lalu jalankan `python3 docs/build_html.py` untuk memperbarui HTML-nya.

## Struktur singkat

```
src/app/api/*        route API (search, home, album, artist, song, lyrics, stream)
src/lib/music.ts     klien YouTube Music + mapping data + cache
src/lib/stream.ts    resolver URL audio
src/components/*     UI pemutar
```
