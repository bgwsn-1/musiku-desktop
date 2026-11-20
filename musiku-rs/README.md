# musiku-rs

Inti (core) aplikasi dalam Rust. **Web di `../` sama sekali tidak diubah.**

Dipakai bareng oleh dua "wajah":
- `crates/server` — server Axum (web & shell Tauri)
- `crates/desktop` — shell Tauri (jendela + paket installer)

## Status

| Fase | Isi | Status |
|---|---|---|
| **0** | Kerangka workspace + `types.rs` + server health | ✅ **selesai** |
| **1** | Endpoint `/api/search` pakai `rustypipe` | ✅ **selesai** |
| **2** | `home`, `song`, `album`, `artist`, `lyrics` + cache | ✅ **selesai** |
| **3** | `stream` (Range), `artwork-proxy`, `artist-logo` | ✅ **selesai** |
| **4a** | Client jalan (server + UI di browser) | ✅ **selesai** |
| **4b** | Shell desktop Tauri (`.exe`/`.deb`/`.dmg`) | ✅ **selesai** |
| **5** | UI **persis web**: komponen React asli di-reuse | ✅ **selesai** |
| **6** | Halaman artis **identik web** + perbaikan proxy stream | ✅ **selesai** |

Semua **11 endpoint** sudah diverifikasi hidup melawan sumber aslinya
(YouTube Music, lrclib, Wikidata/TheAudioDB). Ringkasan hasil ada di
bagian [Verifikasi](#verifikasi) di bawah.

### Fase 6 — halaman artis & proxy stream

Dua cacat yang membuat halaman artis terasa "beda dari web" sudah dibereskan:

1. **Statistik & aset header artis.** `rustypipe` tidak mengekspos avatar
   persegi, banner lebar, jumlah pengikut berformat, maupun pendengar bulanan —
   dan ia memberi subscriber sebagai **angka mentah** (`3070000`), yang bikin UI
   menampilkan "3070000 pengikut". Sekarang `crates/core/src/ytmusic.rs`
   melakukan POST langsung ke `browse` dengan client **WEB_REMIX** (sama seperti
   `artistStats()` di `src/lib/music.ts`) dan membaca
   `musicImmersiveHeaderRenderer`. Hasilnya persis web: `"3.07M"` pengikut,
   `"62.6M monthly audience"`, avatar 544², banner 1728×720, dan id video header.

2. **Stream terputus di detik ke-20.** Client HTTP global dipasang
   `.timeout(20s)` — timeout itu membatasi **seluruh** transfer, jadi proxy
   `/api/stream` memutus audio/video tepat di detik 20. Diganti
   `connect_timeout` + `read_timeout`, sehingga transfer boleh berjalan selama
   data terus mengalir (seperti versi web yang tidak punya timeout).

> Catatan: unduhan mentah tanpa header `Range` memang lambat (~32 KB/s), tapi
> itu perilaku googlevideo sendiri. `<audio>`/`<video>` **selalu** mengirim
> `Range`, dan untuk permintaan ber-`Range` throughput ≈ **5 MB/s**.

### UI: komponen web dipakai ulang, bukan ditulis ulang

Supaya tampilan **sama persis** dengan web, UI desktop **bukan** HTML tulis
tangan — tapi **komponen React asli dari `../src/`** yang dibundel dengan
esbuild. Yang diganti cuma hal yang memang khusus Next.js:

| Web (Next.js) | Di desktop | Alasan |
|---|---|---|
| `next/link` | shim SPA (`ui-src/shims/next-link.jsx`) | navigasi tanpa reload |
| `next/navigation` (`usePathname`/`useRouter`/`useSearchParams`) | shim SPA (`ui-src/shims/router.js`) | router ringan berbasis `history` |
| `next/font/google` | `--font-geist-*` di `index.html` + `@font-face` | font sudah di-embed |
| Halaman `async` server component | versi klien yang `fetch('/api/...')` | tidak ada Node di runtime |

Yang **di-reuse apa adanya**: `lib/player.tsx` (1.125 baris: queue, shuffle,
repeat, crossfade, MediaSession, lirik sinkron), `globals.css` (1.031 baris
design system), dan 40+ komponen presentasi.

CSS di-generate ulang oleh **Tailwind v4 asli** dari `../src/app/globals.css`,
jadi seluruh utility + kelas kustom (`.glass`, `.shell`, `.t-large`, …) identik.

> ⚠️ Mengubah komponen di `../src/` berarti UI desktop ikut berubah —
> jalankan `./build-ui.sh` untuk membangun ulang aset.

## Cara menjalankan

Ada **dua** cara. Keduanya pakai binary Rust yang sudah jadi.

### 1. Aplikasi desktop (jendela)

```bash
cd musiku-rs
cargo run -p musiku-desktop
```

Yang terjadi: server Axum jalan di dalam proses pada port acak, lalu jendela
Tauri membuka `http://127.0.0.1:<port>`. Jendela berjudul **Musiku**.
Server berhenti sendiri saat jendela ditutup.

### 2. Server + UI di browser

```bash
cd musiku-rs
cargo run -p musiku-server
# lalu buka http://127.0.0.1:8787
```

Ganti port: `PORT=9000 cargo run -p musiku-server`

UI-nya ada di `crates/server/ui/index.html`; CSS/JS/font di `ui/assets/`
dan **di-embed ke dalam binary** (`include_bytes!`) — tidak ada file eksternal
yang perlu disalin.

### Yang bisa dilakukan di client sekarang

Persis seperti web: kolom pencarian + 4 tab: **Lagu / Video / Album / Artis**,
halaman **Beranda / Album / Artis / Pustaka / Playlist**, **sidebar** desktop,
**tab bar** HP, **dialog** (buat/hapus playlist, pintasan keyboard), panel
**Lirik** & **Antrian**, toast, gesture swipe-back, dan **player bar** lengkap
(putar, jeda, prev/next, scrub, shuffle, repeat, crossfade, volume, mini player).
Data live dari YouTube Music, audio di-stream lewat `/api/stream/:id`.

### Membangun ulang aset UI

Aset (`ui/assets/app.css`, `ui/assets/app.js`) ikut di-commit, jadi `cargo run`
biasa sudah cukup. Bangun ulang hanya kalau komponen di `../src/` berubah:

```bash
cd musiku-rs
./build-ui.sh          # sekali bangun (minify)
./build-ui.sh --watch  # mode dev, rebuild otomatis
```

Butuh Node + `npm install` sekali di `ui-src/` (script menanganinya).

## Membuat paket distribusi (`.deb`, `.AppImage`, `.exe`, `.dmg`)

Paling gampang, pakai skrip pembungkus:

```bash
cd musiku-rs
./build-installer.sh            # auto sesuai OS sekarang
./build-installer.sh deb        # hanya .deb
./build-installer.sh appimage   # hanya .AppImage
```

Hasilnya di `target/release/bundle/`:

| OS | Perintah | Hasil |
|---|---|---|
| Linux | `./build-installer.sh` | `bundle/deb/Musiku_0.1.0_amd64.deb`, `bundle/appimage/Musiku_0.1.0_amd64.AppImage` |
| Windows | `npx @tauri-apps/cli build --bundles nsis` | `bundle/nsis/Musiku_0.1.0_x64-setup.exe` |
| macOS | `npx @tauri-apps/cli build --bundles dmg` | `bundle/dmg/Musiku_0.1.0_x64.dmg` |

Atau langsung lewat CLI Tauri:

```bash
cd musiku-rs/crates/desktop
npx -y @tauri-apps/cli@^2 build --bundles deb
# atau: cargo install tauri-cli --version "^2" && cargo tauri build
```

**Satu mesin tak bisa menghasilkan tiga OS sekaligus** — `.exe` harus di
Windows, `.dmg` harus di macOS. Untuk ketiganya sekaligus pakai GitHub Actions
(lihat `.github/workflows` di repo web, atau `tauri-apps/tauri-action`).

`.deb` dibuat **native oleh Rust** (tak butuh `dpkg-deb`); `.AppImage`
mengunduh `linuxdeploy` sendiri saat pertama kali.

**Yang perlu diinstal di mesin tujuan (Linux):** `libwebkit2gtk-4.1-0`
(biasanya sudah ada di desktop modern). Tauri **tidak** membundel browser —
ia memakai WebView OS (WebKitGTK di Linux, WebView2 di Windows, WKWebView di
macOS). Itu sebabnya installer-nya kecil.

### Pembaruan dari GitHub Release

Shell desktop mengecek rilis terbaru lewat `/api/update/check` (cache 30 menit)
dan menampilkan entri di bawah sidebar. Tombol "Unduh & pasang" memanggil
`/api/update/install`, yang mengunduh aset sesuai OS, memverifikasi SHA-256 dari
field `digest` GitHub, lalu menjalankan installer NSIS silent (Windows) atau
membuka `.deb` dengan `xdg-open` (Linux). Tombol "Buka di GitHub" memakai
command Tauri `open_external` yang di-whitelist ke repo ini.

Rilis harus memuat aset bernama `*setup.exe` (Windows) dan `.deb`/`.AppImage`
(Linux); tanpa itu tombol unduh melaporkan tidak ada aset untuk platform ini.

### Build Windows dari Linux (tanpa mesin Windows)

`cargo-xwin` bisa menghasilkan exe Windows, dan NSIS bisa dijalankan lewat
Wine — jadi installer pun bisa dibuat di sini:

```bash
cd musiku-rs
./build-exe.sh              # butuh cargo-xwin + clang/nasm/lld di PATH
./build-installer-local.sh  # butuh wine, curl, unzip
```

Hasilnya: `target/windows-installer/Musiku-<versi>-setup.exe` (per-user,
tanpa UAC) plus `target/x86_64-pc-windows-msvc/release/musiku-desktop.exe`.
Installer menyertakan WebView2 Evergreen bootstrapper (~1,8 MB) dan hanya
menjalankannya kalau runtime belum terpasang. NSIS 3.11 dan bootstrapper
diunduh sekali ke `~/.cache/musiku-windows-build`.

Di Windows, jalankan installer, lalu buka Musiku dari Start Menu. Kalau
Windows 10 belum punya WebView2, bootstrapper akan memasangnya saat instal.

> Catatan CI: `.github/workflows/build-windows.yml` butuh OAuth token dengan
> scope `workflow` untuk bisa di-push. Token tanpa scope itu tetap bisa
> memakai jalur lokal di atas.

**Ukuran binary.** Build `debug` membawa seluruh simbol & tanpa optimasi —
`musiku-desktop` bisa **±327 MB**. Itu **normal** dan tidak pernah dipakai
untuk distribusi. Pakai `cargo build --release`:

```bash
cd musiku-rs
cargo build --release -p musiku-desktop
ls -lh target/release/musiku-desktop
```

`[profile.release]` di `Cargo.toml` sudah memasang `opt-level="s"`, `lto`,
`codegen-units=1`, dan `strip=true` khusus agar binary rilis sekecil mungkin.
Di Linux, `musiku-server` rilis ≈ **15 MB** dan `musiku-desktop` ≈ **10 MB**.
(Tauri memakai WebKitGTK/WebView2, jadi **tidak** ada Chromium yang dibundel —
sebagian besar ukuran installer adalah WebView milik OS.)

## Struktur

```
musiku-rs/
├─ crates/core/     ← tipe + mapping + resolver stream (dipakai bareng)
├─ crates/server/   ← Axum: API + UI  (lib.rs = router, main.rs = bin)
│  └─ ui/
│     ├─ index.html ← kerangka shell (di-embed ke binary)
│     └─ assets/    ← app.css + app.js + fonts (di-embed ke binary)
├─ crates/desktop/  ← shell Tauri (jendela + paket installer)
│  └─ icons/        ← diturunkan dari src/app/icon.png (web)
├─ ui-src/          ← sumber build UI (shim Next.js, entry, konfigurasi)
│  ├─ entry.jsx     ← shell + halaman klien (fetch /api/*)
│  ├─ shims/        ← next/link, next/navigation, next/font
│  └─ build*.mjs    ← bundel Komponen web (esbuild) + CSS (Tailwind)
└─ build-ui.sh      ← pembungkus: bangun CSS + JS sekaligus
```

Isi `crates/core/src/`:

| Modul | Isi |
|---|---|
| `types.rs` | port lengkap `src/lib/types.ts` |
| `music.rs` | endpoint metadata (`search`/`home`/`album`/`artist`/`song`/`lyrics`) + cache 10 menit |
| `player.rs` | ambil URL stream lewat client VISIONOS (pengganti jalur `rustypipe`) |
| `ytmusic.rs` | browse mentah client WEB_REMIX: avatar/banner/pengikut/pendengar/video header artis |
| `stream.rs` | cache 30 menit + pemilihan format audio/video |
| `artist_logo.rs` | wordmark Wikidata → TheAudioDB |
| `cache.rs` | `JsonCache` / `StrCache` / `BytesCache` (moka, TTL + dedup) |


### Hasil Fase 1 (diverifikasi lawan Next.js yang asli)

`GET /api/search` menghasilkan **bentuk JSON identik** dengan versi Next.js:

| Filter | Nama field | Tipe field |
|---|---|---|
| `songs` | ✅ sama | ✅ sama |
| `videos` | ✅ sama | ✅ sama |
| `albums` | ✅ sama | ✅ sama |
| `artists` | ✅ sama | ✅ sama |

Status kode: `400` (input salah) dan `502` (upstream gagal) juga sama.

**Catatan — urutan hasil:** sejak cache TTL 10 menit terpasang (Fase 2),
pemanggilan berulang untuk kata kunci sama mengembalikan hasil yang sama,
sama seperti `cached()` di `music.ts`. Untuk request segar, urutan dari
YouTube Innertube tetap non-deterministik — ini sifat sumbernya, bukan bug
mapping.

## Verifikasi

Semua endpoint diuji dengan server hidup + sumber asli (bukan mock):

| Endpoint | Hasil |
|---|---|
| `GET /api/health` | `{"ok":true,"service":"musiku-server"}` |
| `GET /api/search?filter=songs` | array 20 lagu, field & tipe cocok |
| `GET /api/search?filter=videos` | array, `resultType="video"` |
| `GET /api/search?filter=albums` | array, ada `browseId` |
| `GET /api/search?filter=artists` | array, ada `browseId` |
| `GET /api/home` | 3 shelf: Rilis Baru (12), Video Musik Baru (12), Artis Populer (12) |
| `GET /api/album/:id` | 22 lagu, judul + tahun + durasi |
| `GET /api/artist/:id` | 17 topSongs, 7 album, 10 single, `"3.07M"` pengikut, `"62.6M monthly audience"`, avatar + banner + `topVideoId` (identik web) |
| `GET /api/song/:id` | judul + 20 lagu terkait |
| `GET /api/lyrics/:id` | lrclib, `synced=true`, 3.349 karakter |
| `GET /api/stream/:id` | `206` + `content-range`; unduh penuh 4,1 MB OK; `Range` di tengah file OK |
| `GET /api/stream/:id?video=1` | `206 video/mp4` |
| `GET /api/artwork-proxy?url=` | `200 image/jpeg`; host di luar whitelist → `400` |
| `GET /api/artist-logo?name=` | `{"url": ...}`; nama tanpa logo → `null` |
| `GET /api/artist-logo/file?name=` | `200 image/png|jpeg` (fallback Wikidata → TheAudioDB) |
| `GET /` | UI Musiku ter-embed |
| `GET /assets/app.css` | `200 text/css`; memuat `globals.css` asli + 13 `@font-face` |
| `GET /assets/app.js` | `200 text/javascript`; bundel React (~351 KB) |
| `GET /assets/fonts/:name` | `200 font/woff2` |
| `GET /liked`, `/search`, `/album/:id`, … | SPA fallback → UI (rute ditangani klien) |

**UI diverifikasi di browser sungguhan** (Chromium headless, CDP): shell
ter-mount, foto sampul termuat, klik lagu → `<audio>` memutar (posisi berjalan
0:29 → 0:31), panel antrian terbuka lewat pintasan `q`, dan mode gelap/terang
ikut `prefers-color-scheme`. Halaman Beranda, Album, Artis, Pencarian, dan
Pustaka semuanya render. Hasilnya **identik dengan web** karena memakai
komponen + CSS yang sama.

## Penyimpangan dari versi TS (dan alasannya)

1. **`home` disusun ulang.** `rustypipe` tidak punya "startpage"
   (`getHomeSections()` di `ytmusic-api`). Per 2026 YouTube juga mengubah
   susunan respons charts sehingga `music_charts().top_tracks` kosong (artis
   masih terisi). Jadi beranda dibangun dari `music_new_albums` +
   `music_new_videos` + artis populer. **Bentuk `HomeShelf[]` tetap sama**,
   sehingga UI tidak perlu diubah — hanya isi/susunannya yang berbeda.

2. **Stream tidak lewat `rustypipe`.** Ini yang paling penting. `rustypipe`
   mengambil URL stream dengan mendeobfuscate `player.js` YouTube; per 2026
   langkah itu gagal (`deobfuscation error: could not get deobf data`),
   sehingga ia jatuh ke client **iOS**. URL client iOS **ter-throttle**:
   hanya ~1,15 MB pertama yang bisa diakses, di atasnya googlevideo membalas
   `403`. Akibatnya lagu muter sebentar lalu mati dan seek selalu gagal.
   Versi TS lolos dari ini karena memakai `@distube/ytdl-core` dengan client
   **VISIONOS** (Apple Vision Pro). `crates/core/src/player.rs` meniru langkah
   itu: satu POST ke `youtubei/v1/player` + `visitorData` dari
   `youtube.com/sw.js_data`. URL yang dihasilkan bisa diakses **penuh**.

3. **Statistik artis dibaca dari browse mentah.** `rustypipe` tidak
   mengekspos avatar persegi, id video header, dan monthly listener, serta
   memberi subscriber sebagai angka mentah. Fase 6 menambahkan
   `crates/core/src/ytmusic.rs` yang mem-POST `browse` dengan client WEB_REMIX
   dan membaca `musicImmersiveHeaderRenderer` — persis `artistStats()` di versi
   TS — sehingga `subscribers`/`monthlyListeners` berupa **teks berformat**
   (`"3.07M"`) dan `avatar`/`banner`/`topVideoId` terisi. `desc` diisi
   deskripsi asli (versi TS memakai `null`); UI sudah tahan terhadapnya.

4. **`topVideoId` diambil dari judul carousel, bukan indeks.** `ytmusic-api`
   memakai indeks tetap (`musicCarouselShelfRenderer[2]`) yang per 2026
   menunjuk carousel yang salah (bahkan mengembalikan `videoId` kosong).
   `ytmusic.rs` mencari carousel yang judulnya diawali "Video" — lebih tahan
   terhadap perubahan susunan YouTube.

5. **Logo artis di-cache byte-nya.** Wikimedia membalas `429 Too Many
   Requests` kalau dihit berulang cepat. Server menyimpan byte gambar di
   memori (7 hari) dan mencoba kandidat berikutnya kalau sumber pertama gagal.

## Cara pakai

```bash
# test tipe & format
cargo test

# jalanin server
cargo run -p musiku-server
# → http://127.0.0.1:8787/api/health

# ganti port
PORT=9000 cargo run -p musiku-server
```

## Yang sudah ada (`crates/core/src/types.rs`)

Port lengkap dari `src/lib/types.ts`:

- `Track`, `AlbumSummary`, `AlbumDetail`, `ArtistDetail`
- `HomeItem`, `HomeShelf`, `Lyrics`, `Playlist`
- enum bantu: `Duration`, `ArtistName`, `Count`, `HomeItemKind`
- `format_secs()` → menyamai `src/lib/timefmt.ts`

Semua field JSON dipertahankan camelCase (`videoId`, `isExplicit`, dst) dan
field `None` dibuang saat serialisasi — supaya frontend yang ada bisa langsung
mengonsumsi output tanpa perubahan.

`cargo test` lulus **12 tes**: bentuk camelCase, skip `None`, `Duration` dua
bentuk, `format_secs` cocok versi TS, pemilihan format audio/video di
`player.rs` (m4a diutamakan; avc1 ≤720p; format tanpa `url` langsung di-skip),
serta aset UI ter-embed & semua font tersedia.

## Aturan yang dijaga

1. Bentuk JSON tiap endpoint **sama** dengan versi Next.js.
2. Jalur URL **sama** (`/api/search`, `/api/stream/:id`, dst).
3. `../src/app/globals.css` + komponen web dipakai apa adanya (di-bundel).
4. Web lama tidak disentuh — hanya dibaca saat build UI.
