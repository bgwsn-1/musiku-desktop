# Rancangan: Animasi Lirik Gaya “Spicy” untuk Musiku

Dokumen desain (belum ada kode). Tujuannya: memindahkan **konsep** animasi Spicy
Lyrics ke Musiku dengan penulisan ulang bersih (clean-room), bukan menyalin kode
repo `Spikerko/spicy-lyrics`.

## 1. Hasil baca kode Spicy (inti animasinya)

### 1.1 Model data & status
- Lirik syllable: `LineData { Lead: SyllableData[] }`, tiap syllable punya
  `StartTime`/`EndTime`; kata yang dipecah jadi `Parts`/`Letters`.
- Status per baris dihitung tiap tick: `NotSung` / `Active` / `Sung`
  (`TimeSetter`), bandingkan posisi + offset terhadap `StartTime`/`EndTime`.

### 1.2 Loop per frame (`Animate(position)`)
- Dipanggil setiap rAF oleh scheduler pemutar; `deltaTime` dari `performance.now()`.
- Hanya baris yang ter-mount dan sekitar aktif yang diproses; elemen yang
  `!isConnected` dilewati (karena ada virtualizer).
- Mulai tiap frame: reset sweep baris, update class Active/Settling/Sung,
  blur baris terdekat, baru step semua kata.

### 1.3 Gerak per kata: spring fisik, bukan tween per elemen
- Tiap kata menyimpan `AnimatorStore` berisi `Spring` untuk `Scale`, `YOffset`,
  `Glow` (dan `Opacity` untuk baris instrumental/ titik).
- Target spring diambil dari **spline** yang dievaluasi pada persen kemajuan
  kata (`percentage = (pos-start)/(end-start)`), contoh:
  - Scale: `0.95 → 1.0505 @0.7 → 1`
  - Glow: `0 → 1 @0.15 → 1 @0.6 → 0`
  - YOffset: `+1/100 → −1/60 @0.9 → 0` (relatif terhadap `--DefaultLyricsSize`)
- Parameter spring: frekuensi ~0.88–1.45 Hz, damping 0.4–0.64 (under-damped,
  jadi ada sedikit overshoot). Implementasi integrator analitik
  (critical/under/over-damped) — bukan `lerp` per frame.
- Varian “Bloom”: scale/glow tidak pakai spring; gradient sweep mengikuti lebar
  baris dan posisi; kata melayang berdasarkan waktu (eased, pinned).

### 1.4 Penulisan gaya (performa)
- Semua gerak lewat CSS custom property/transform (`scale`, `translate3d`,
  `--text-shadow-*`, `--gradient-position`).
- `_styleCache` + `setStyleIfChanged` dengan epsilon: tulis ulang hanya bila
  perubahan signifikan (hindari thrash style tiap frame).
- Write di-queue per elemen, di-flush sekali per frame (`flushStyleBatch`).
- GPU promotion hanya untuk baris aktif/sekitar (`will-change`), lalu
  “park” transform yang hampir nol agar layer compositor dilepas.
- Blur antar-baris memakai `text-shadow`, bukan `filter` (temuan mereka:
  `filter` menambah offscreen pass).

### 1.5 Scroll
- Pemetaan posisi→progres scroll (`StaticPace`): vokal (voice activity) →
  loudness → pace linear; di Musiku kita bisa mulai linear/paced sederhana.
- Mode Center/Top; offset tengah ~30px; jeda scroll saat user scroll sendiri
  (cooldown 750 ms) lalu resume; tombol “kembali ke baris aktif”; deteksi hover.
- Virtualizer (TanStack Virtual) memasang hanya jendela baris; scroll-to-index.

### 1.6 Yang TIDAK port (terikat Spotify / data tak tersedia)
- Sumber syllable timing Spotify, NPV canvas/video, romanization
  (kuromoji/kuroshiro), dynamic BG server-side Spotify, DB lokal idb,
  voice-activity & audio analysis Spotify.

## 2. Perbedaan data Musiku → implikasi teknik

Musiku hari ini:
- Lirik dari lrclib: LRC **level baris** (`[mm:ss.xx] teks`), kadang tanpa SYNced.
- Posisi pemutar diperbarui lewat `timeupdate` (~4 Hz) → kalau langsung jadi
  target, gerak patah-patah.
- Sudah ada `LyricsPanel` (blur/scale per baris) dan `ImmersiveLyrics`
  (Apple Motion/HLS + canvas sampling warna).

Konsekuensi desain:
1. **Interpolasi posisi**: runtime animasi harus punya sumber posisi mulus.
   Simpan `position` terakhir + timestamp; tiap rAF eksplorasi linear ke
   posisi target; saat seek, snap.
2. **Pseudo-kata**: dari teks baris, pecah jadi kata; alokasikan durasi baris
   ke kata proporsional terhadap jumlah karakter (minimum per kata, sisakan jeda
   spasi). Ini memberi karaoke/gerak kata walau sumber hanya baris.
   - Format alternatif: kalau suatu sumber nanti memberi word timings (TTML),
     pakai langsung; arsitektur segment harus netral (line → words → letters).
3. Tanpa virtualizer dulu: lagu ~40–80 baris, DOM masih murah; ukur dulu.

## 3. Arsitektur yang diusulkan di Musiku (penulisan ulang)

Semua milik Musiku, lisensi tetap MIT.

```
src/lib/lyrics-anim/
  easing.ts        # spline/keyframes (cubic-bezier + piecewise), clamp
  spring.ts        # integrator spring analitik (under/critical/over-damped)
  timing.ts        # LRC -> LineSegments {start,end,text,words:{start,end,text}[]
                   # + label status; konversi posisi -> progres scroll
src/components/AnimatedLyrics.tsx
                   # view: renders baris/kata, rAF loop, style batching,
                   #       scroll center + user cooldown, reduced-motion
src/app/globals.css# kelas/variabel .sl-line/.sl-word, glow, mask, container
```

Integrasi:
- `LyricsPanel` mendapat mode tampilan (mis. pengaturan lokal
  `lyricsStyle: "classic" | "spicy"`), default tetap classic supaya perilaku
  lama tidak berubah; spicy dipakai setelah verifikasi.
- `ImmersiveLyrics` dapat memakai renderer yang sama untuk barisnya kemudian
  (fase lanjut).

### Alur per frame (rancangan)
```
onRAF(now):
  pos = interpolate(playerPosition, lastPos, lastTs, now)
  dt  = (now - lastNow)/1000
  for line in visible lines:
    status = classify(pos, line.start, line.end)
    update class hanya bila berubah
    if line active/near:
      for word in line.words:
        pct = clamp((pos-word.start)/(word.end-word.start))
        targets = splines.evaluate(status,pct)
        spring.SetGoal(...); value=spring.Step(dt)
        queueStyle(el, prop, value) dengan epsilon
  flushStyleBatch()
```
- Layout: `.sl-line` berisi `.sl-word` (span) — same-layer, tidak absolute.
- Glow/blur: `text-shadow` + `--sl-blur` per jarak baris, bukan `filter`.
- Scroll: container scroll manual; target = offsetTop baris aktif − 32% tinggi
  viewport; lerp halus (bukan `behavior:smooth` tak terkendali); berhenti saat
  user scroll (event + cooldown 750 ms); lanjut otomatis.
- Reduced motion: matikan spring/slide; tampil statis.

### Angka awal (dicopy sebagai titik tolak, disetel ulang nanti)
- Scale spline `0.95 → 1.05 @0.7 → 1`; Glow `0 → 1 @0.15 → 1 @0.6 → 0`;
  Y `+0.01em → −1/60em @0.9 → 0`.
- Spring: scale f=0.9 Hz d=0.64; y f=1.45 Hz d=0.4; glow f=1.2 Hz d=0.56.
- Epsilon style: scale 0.001, transform 0.0001, opacity 0.01.

## 4. Rencana bertahap (satu concern per commit)

Fase 0 — util:
- `spring.ts` + `easing.ts` + `timing.ts` (LRC→segments) + unit test murni.

Fase 1 — renderer minimum:
- `AnimatedLyrics` dengan spring skala/glow/y-offset + style batching +
  blur berbasis jarak; dipakai lewat toggle pengaturan; posisi diinterpolasi
  rAF; reduced-motion fallback. Uji di WebView asli (bukan Chromium saja).

Fase 2 — scroll:
- Center-scroll ter-paced sederhana + cooldown user + tombol “ke aktif”.

Fase 3 — penyempurnaan:
- Gradient fill karaoke (bloom-like) bila data kata tersedia;_opsional_;
- latar dinamis dari artwork (kanvas Musiku sendiri).

## 5. Verifikasi (wajib sebelum klaim “selesai”)

- Build: `./build-ui.sh && cargo build -p musiku-server -p musiku-desktop`.
- Reproduksi GUI di app desktop betulan (WebView), bukan hanya browser.
- Ukur: FPS/frame time & CPU saat lirik panjang; pastikan tidak ada freeze saat
  ganti lagu; uji seek/pause/rapid next; uji lirik tanpa synced; uji
  `prefers-reduced-motion`.
- Rollback: toggle mematikan spicy kembali ke `LyricsPanel` lama.

## 6. Lisensi & etika

Repo Spicy berlisensi **AGPL-3.0**. Menyalin/menurunkan kodenya ke Musiku (MIT)
berarti karya turunan wajib AGPL + membuka sumber. Karena itu semua di atas
ditulis ulang dari nol (konsep/teknik, bukan baris kode). Angka kurva/spring
hanya titik tolak teknis yang akan disetel ulang; implementasi math-nya milik
Musiku.