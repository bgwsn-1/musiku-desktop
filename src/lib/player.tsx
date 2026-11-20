"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Track, Playlist } from "@/lib/types";
import { toast } from "@/components/Toast";

type Repeat = "off" | "all" | "one";

type PlayerState = {
  current: Track | null;
  queue: Track[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  volume: number;
  muted: boolean;
  crossfade: boolean;
  toggleCrossfade: () => void;
  /** durasi crossfade dalam detik (bisa diatur user) */
  cfSec: number;
  cycleCfSec: () => void;
  setCfSec: (n: number) => void;
  autoplay: boolean;
  toggleAutoplay: () => void;
  /** index pertama lagu yang ditambahkan putar-otomatis (null = tidak ada) */
  autoplayFrom: number | null;
  resolving: boolean;
  error: string | null;
  liked: Track[];
  playlists: Playlist[];
  recent: Track[];
  playTracks: (tracks: Track[], startIndex?: number) => void;
  playOne: (t: Track, contextQueue?: Track[]) => void;
  enqueue: (t: Track, at?: number) => void;
  removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  toggleLike: (t: Track) => void;
  isLiked: (videoId: string) => boolean;
  createPlaylist: (name: string) => string;
  deletePlaylist: (pid: string) => void;
  addToPlaylist: (pid: string, t: Track) => void;
  removeFromPlaylist: (pid: string, videoId: string) => void;
  ui: null | "lyrics" | "queue";
  toggleUi: (name: "lyrics" | "queue") => void;
};

const Ctx = createContext<PlayerState | null>(null);

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

const STREAM = (id: string) => `/api/stream/${id}`;
const LS = {
  liked: "musiku.liked",
  playlists: "musiku.playlists",
  recent: "musiku.recent",
  volume: "musiku.volume",
  repeat: "musiku.repeat",
  crossfade: "musiku.crossfade",
  crossfadeSec: "musiku.crossfade-sec",
  shuffle: "musiku.shuffle",
  autoplay: "musiku.autoplay",
};

// ── Crossfade ────────────────────────────────────────────────────────────
// Dua elemen audio: yang live memudar keluar, lagu berikutnya memudar masuk.
const DEFAULT_CF_SEC = 4;
const CF_PRESETS = [2, 4, 6, 8, 10, 12];

const mediaSession = () =>
  typeof navigator !== "undefined" && "mediaSession" in navigator
    ? navigator.mediaSession
    : null;

// ── Pre-buffer antrian ───────────────────────────────────────────────────
// Upstream Google membatasi ±realtime per koneksi, jadi mengunduh satu lagu
// penuh lewat fetch tidak praktis. Yang dibuat: elemen audio bayangan
// mem-buffer lagu berikutnya lebih awal (preload="auto"), sehingga saat
// crossfade/manual next, data awal sudah siap dan play() langsung jalan.

function ls<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function fmtTime(s: number | undefined | null): string {
  if (s == null || !isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [crossfade, setCrossfade] = useState(false);
  const [cfSec, setCfSecState] = useState(DEFAULT_CF_SEC);
  const [autoplay, setAutoplay] = useState(false);
  const [autoplayFrom, setAutoplayFrom] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recent, setRecent] = useState<Track[]>([]);
  const [ui, setUi] = useState<null | "lyrics" | "queue">(null);
  const [hydrated, setHydrated] = useState(false);

  // elemen audio kedua untuk crossfade; audioRef = yang LIVE
  const shadowRef = useRef<HTMLAudioElement | null>(null);
  const fadingRef = useRef(false);
  const rafRef = useRef(0);
  const crossfadeRef = useRef(false);
  const cfRef = useRef(DEFAULT_CF_SEC);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<Map<HTMLAudioElement, GainNode>>(new Map());
  const analyserRef = useRef<Map<HTMLAudioElement, AnalyserNode>>(new Map());
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volRef = useRef(volume);
  const errCountRef = useRef(0);

  const toggleUi = useCallback((name: "lyrics" | "queue") => {
    setUi((u) => (u === name ? null : name));
  }, []);

  // hydrate
  useEffect(() => {
    setLiked(ls<Track[]>(LS.liked, []));
    setPlaylists(ls<Playlist[]>(LS.playlists, []));
    setRecent(ls<Track[]>(LS.recent, []));
    const v = ls<number>(LS.volume, 0.8);
    setVolumeState(v);
    setRepeat(ls<Repeat>(LS.repeat, "off"));
    setShuffle(ls<boolean>(LS.shuffle, false));
    setCrossfade(ls<boolean>(LS.crossfade, false));
    const cs = ls<number>(LS.crossfadeSec, DEFAULT_CF_SEC);
    const valid = CF_PRESETS.includes(cs) ? cs : DEFAULT_CF_SEC;
    setCfSecState(valid);
    cfRef.current = valid;
    setAutoplay(ls<boolean>(LS.autoplay, true));
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) save(LS.liked, liked);
  }, [liked, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.playlists, playlists);
  }, [playlists, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.recent, recent.slice(0, 40));
  }, [recent, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.volume, volume);
  }, [volume, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.repeat, repeat);
  }, [repeat, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.shuffle, shuffle);
  }, [shuffle, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.crossfade, crossfade);
  }, [crossfade, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    save(LS.crossfadeSec, cfSec);
    cfRef.current = cfSec;
  }, [cfSec, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.autoplay, autoplay);
  }, [autoplay, hydrated]);
  useEffect(() => {
    crossfadeRef.current = crossfade;
  }, [crossfade]);

  // create audio element (browser autoplay-safe: created on first interaction path)
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    a.preload = "auto";
    a.volume = volume;
    audioRef.current = a;
    return a;
  }, [volume]);

  const ensureShadowElement = useCallback(() => {
    if (shadowRef.current) return shadowRef.current;
    const s = new Audio();
    s.preload = "auto";
    s.volume = 0;
    shadowRef.current = s;
    return s;
  }, []);

  // ── Web Audio: ramp volume di audio thread — mulus tanpa "tangga" ────────
  // rAF bisa di-throttle browser (tab tak fokus, tab berat) sehingga fade
  // berbasis frame jadi patah-patah. GainNode dijadwalkan dengan timestamp
  // sendiri, jadi kurvanya presisi berapapun beban tab.
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  /** Pastikan elemen audio terhubung ke GainNode-nya; return gain tersebut. */
  const gainFor = useCallback(
    (el: HTMLAudioElement) => {
      const ctx = getCtx();
      if (!ctx) return null;
      let g = gainRef.current.get(el);
      if (!g) {
        g = ctx.createGain();
        g.gain.value = 1;
        const src = ctx.createMediaElementSource(el);
        src.connect(g);
        g.connect(ctx.destination);
        // tap PEMBACAAN loudness — pre-gain (dari source), jadi sinyal yang
        // terukur tak terpengaruh gain fade; AnalyserNode tak butuh output
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        src.connect(an);
        analyserRef.current.set(el, an);
        gainRef.current.set(el, g);
      }
      return g;
    },
    [getCtx],
  );

  /**
   * Pasang graf audio (element → gain → destination) SEBELUM playback —
   * rewiring di tengah lagu bikin hiccup. Dipanggil saat play pertama kali.
   */
  const primeAudioGraph = useCallback(() => {
    const a = ensureAudio();
    const s = ensureShadowElement();
    gainFor(a);
    gainFor(s);
    getCtx();
  }, [ensureAudio, ensureShadowElement, gainFor, getCtx]);

  /**
   * Ukur loudness (RMS) elemen lewat AnalyserNode permanen di grafnya —
   * analogi Sound Check-nya Apple: dua lagu beda mastering berbeda kenyaringan;
   * tanpa koreksi, crossfade terdengar "melesat" atau "tenggelam" di tengah.
   * Mengembalikan RMS linier 0..~1. Melewati resolve(1) = tak ada koreksi.
   */
  const measureLoudness = useCallback(
    (el: HTMLAudioElement, windowMs = 800): Promise<number> => {
      return new Promise((resolve) => {
        const ctx = ctxRef.current;
        const an = ctx && analyserRef.current.get(el);
        if (!ctx || !an) return resolve(1);
        const buf = new Float32Array(an.fftSize);
        const started = performance.now();
        let sumSq = 0;
        let n = 0;
        const tick = () => {
          // elemen sudah tidak jadi bagian pengukuran (mis. fade batal)
          if (!el.isConnected && el.paused && n > 0) {
            return resolve(Math.max(Math.sqrt(sumSq / n), 1e-4));
          }
          an.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
          n += buf.length;
          if (performance.now() - started < windowMs && !el.paused) {
            requestAnimationFrame(tick);
          } else {
            resolve(Math.max(Math.sqrt(sumSq / (n || 1)), 1e-4));
          }
        };
        requestAnimationFrame(tick);
      });
    },
    [],
  );

  /**
   * Crossfade via GainNode — arsitektur PlayerAudioFadeControl Apple Music:
   *  - CONSTANT_POWER: out=cos, in=sin
   *  - fade-in tertunda (lead/follow time-range terpisah)
   *  - sound check: gain koreksi loudness lagu masuk (default 1)
   *  - ramp dijadwalkan penuh di audio thread
   */
  const scheduleGainFade = useCallback(
    (
      live: HTMLAudioElement,
      shadow: HTMLAudioElement,
      fadeMs: number,
      v: number,
      onDone: () => void,
      fadeInGain = 1,
    ): boolean => {
      const ctx = getCtx();
      const gl = gainFor(live);
      const gs = gainFor(shadow);
      if (!ctx || !gl || !gs || fadeMs <= 0) return false;
      const t = ctx.currentTime;
      const dur = fadeMs / 1000;
      // fade-in baru "menyusul" setelah lagu lama turun dulu — 22% dari window
      const IN_DELAY = 0.22;
      gl.gain.cancelScheduledValues(t);
      gs.gain.cancelScheduledValues(t);
      gl.gain.setValueAtTime(v, t); // posisi sekarang: lagu lama full
      gs.gain.setValueAtTime(0, t); // lagu baru hening
      // ramp ber-piece linear, tiap piece ~33ms — sink interpolasi mulus
      const N = Math.max(12, Math.min(120, Math.ceil(dur * 30)));
      for (let i = 1; i <= N; i++) {
        const k = i / N;
        const tk = t + k * dur;
        gl.gain.linearRampToValueAtTime(v * Math.cos((k * Math.PI) / 2), tk);
        const ki = Math.max(0, (k - IN_DELAY) / (1 - IN_DELAY));
        gs.gain.linearRampToValueAtTime(
          v * fadeInGain * Math.sin((ki * Math.PI) / 2),
          tk,
        );
      }
      // selama ramp, kendali pindah ke gain
      live.volume = 1;
      shadow.volume = 1;
      fadeTimerRef.current = setTimeout(() => {
        fadeTimerRef.current = null;
        gl.gain.cancelScheduledValues(0);
        gl.gain.value = 1;
        gs.gain.cancelScheduledValues(0);
        gs.gain.value = 1;
        onDone();
      }, fadeMs + 50);
      return true;
    },
    [getCtx, gainFor],
  );

  // fade yang sedang jalan diselesaikan seketika (user menekan next/prev)
  const finishFadeNow = useCallback(() => {
    if (!fadingRef.current) return;
    fadingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    // hentikan ramp Web Audio yang masih terjadwal
    const ctx = ctxRef.current;
    const live = audioRef.current;
    const shadow = shadowRef.current;
    if (ctx) {
      for (const el of [live, shadow]) {
        const g = el ? gainRef.current.get(el) : null;
        if (g) {
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.value = 1;
        }
      }
    }
    if (live && shadow) {
      audioRef.current = shadow;
      shadowRef.current = live;
      live.pause();
      const v = volRef.current;
      live.volume = v;
      shadow.volume = v;
    }
  }, []);

  // buffer lagu berikutnya di elemen bayangan — pindah/crossfade tanpa loading
  const preloadNext = useCallback(() => {
    if (fadingRef.current) return;
    const q = queueRef.current;
    const i = indexRef.current;
    const ni = i + 1 < q.length ? i + 1 : repeatRef.current === "all" && q.length ? 0 : -1;
    const nt = ni >= 0 ? q[ni] : null;
    if (!nt) return;
    const s = ensureShadowElement();
    if (s.dataset.preloadId === nt.videoId) return;
    s.dataset.preloadId = nt.videoId;
    s.preload = "auto";
    s.src = STREAM(nt.videoId);
    s.load();
  }, [ensureShadowElement]);

  // refresh pre-buffer tiap lagu/antrian berubah
  useEffect(() => {
    if (!hydrated) return;
    preloadNext();
  }, [hydrated, current, queue, index, preloadNext]);

  const playIndex = useCallback(
    async (qid: string) => {
      const a = ensureAudio();
      const t = queueRef.current.find((x) => x.videoId === qid);
      if (!t) return;
      setCurrent(t);
      setResolving(true);
      setError(null);
      a.src = STREAM(qid);
      a.play().catch(() => setPlaying(false));
      setRecent((r) => [t, ...r.filter((x) => x.videoId !== qid)].slice(0, 40));
    },
    [ensureAudio],
  );
  void playIndex;

  // keep a ref to queue for closures
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const startAt = useCallback(
    (tracks: Track[], startIndex: number, useShuffle: boolean) => {
      if (!tracks.length) return;
      let q = [...tracks];
      let idx = startIndex;
      if (useShuffle) {
        const first = tracks[startIndex];
        const rest = shuffled(tracks.filter((_, i) => i !== startIndex));
        q = [first, ...rest];
        idx = 0;
      }
      setQueue(q);
      setIndex(idx);
      queueRef.current = q;
      indexRef.current = idx;
      setCurrent(q[idx]);
      setResolving(true);
      setError(null);
      finishFadeNow();
      primeAudioGraph(); // graf siap sebelum stream mulai — tanpa rewiring mid-play
      const a = ensureAudio(); // setelah finishFadeNow: ref sudah dalam peran final
      a.src = STREAM(q[idx].videoId);
      a.play().catch(() => {});
      setRecent((r) => [q[idx], ...r.filter((x) => x.videoId !== q[idx].videoId)].slice(0, 40));
      preloadNext();
    },
    [ensureAudio, preloadNext],
  );

  const playTracks = useCallback(
    (tracks: Track[], startIndex = 0) => {
      setAutoplayFrom(null);
      autoplayFromRef.current = null;
      startAt(tracks, startIndex, false);
    },
    [startAt],
  );

  const playOne = useCallback(
    (t: Track, contextQueue?: Track[]) => {
      setAutoplayFrom(null);
      autoplayFromRef.current = null;
      const base = contextQueue?.length ? contextQueue : [t];
      const i = base.findIndex((x) => x.videoId === t.videoId);
      startAt(base, i < 0 ? 0 : i, false);
    },
    [startAt],
  );

  // ── Crossfade: mulai lagu berikutnya di elemen bayangan, saling menyilang ──
  const beginFade = useCallback(
    (q: Track[], ni: number) => {
      const live = audioRef.current;
      const shadow = ensureShadowElement();
      const t = q[ni];
      if (!live || !shadow || !t) return;
      fadingRef.current = true;
      // metadata pindah di awal fade — seperti Music
      setIndex(ni);
      indexRef.current = ni;
      setCurrent(t);
      setResolving(true);
      setError(null);
      setDuration(0);
      setPosition(0);
      positionRef.current = 0;
      setRecent((r) => [t, ...r.filter((x) => x.videoId !== t.videoId)].slice(0, 40));
      // elemen bayangan kemungkinan sudah mem-buffer lagu ini (preloadNext);
      // sumber hanya diganti kalau targetnya berbeda dari yang di-buffer.
      if (shadow.dataset.preloadId !== t.videoId) {
        shadow.dataset.preloadId = t.videoId;
        shadow.preload = "auto";
        shadow.src = STREAM(t.videoId);
        shadow.load();
      }
      shadow.currentTime = 0;
      shadow.volume = 0;
      shadow.play().catch(() => {});
      // metadata shadow sudah termuat saat preload → loadedmetadata tak fire
      // lagi; ambil durasinya langsung. Kalau belum, onMeta yang mengisi.
      if (isFinite(shadow.duration) && shadow.duration > 0) setDuration(shadow.duration);
      else setDuration(0);
      // fade diselesaikan TEPAT saat lagu lama tamat: kalau fade terpicu saat
      // sisa waktu lebih pendek dari settingan (mis. user baru saja seek ke
      // dekat akhir), durasi fade dipangkas mengikuti sisa — jangan ada masa
      // senyap setelah lagu lama habis.
      const remain =
        isFinite(live.duration) && live.duration > 0
          ? Math.max(live.duration - live.currentTime, 0.3)
          : cfRef.current;
      const fadeMs = Math.min(cfRef.current, remain) * 1000;
      const done = () => {
        // fade selesai: peran ditukar
        audioRef.current = shadow;
        shadowRef.current = live;
        live.pause();
        const v = volRef.current;
        live.volume = v;
        shadow.volume = v;
        fadingRef.current = false;
        preloadNext(); // buffer lagu setelahnya di elemen yang barusan bebas
      };
      // Mulai fade hanya ketika lagu baru benar-benar siap bunyi (Apple:
      // isMediaPeriodReady) — kalau tidak, lagu baru meng-buffer justru saat
      // volumenya naik → dead-air. Tunggu sampai HAVE_CURRENT_DATA (maks 2 dtk);
      // kalau lewat, tetap fade (jangan hang) — startAt-nya cukup muter.
      const startFade = () => {
        // Sound Check ala Apple (SVAudioRendererV2: pendingVolume *=
        // soundCheckGain): ukur RMS ekor lagu keluar & kepala lagu masuk lewat
        // tap pre-gain — pengukuran valid walau gain lagu baru nol. Dua jendela
        // paralel ≤300ms; fade terpicu jauh sebelum lagu tamat, jadi runway
        // cukup. Durasi ramp dipangkas mengikuti waktu pengukuran.
        const want = fadeMs >= 900 ? Math.min(300, Math.floor(fadeMs * 0.15)) : 0;
        const finish = (fadeInGain: number, consumedMs: number) => {
          if (!fadingRef.current) return;
          const ms = Math.max(200, fadeMs - consumedMs);
          // jalur utama: ramp via Web Audio (mulus, bebas throttling);
          // penukaran peran elemen dilakukan oleh timer yang sama dengan ramp
          if (scheduleGainFade(live, shadow, ms, volRef.current, done, fadeInGain)) {
            return;
          }
          // fallback: rAF (tanpa Web Audio)
          const t0 = performance.now();
          const step = () => {
            if (!fadingRef.current) return;
            const v = volRef.current;
            const k = Math.min((performance.now() - t0) / ms, 1);
            live.volume = Math.max(0, v * Math.cos((k * Math.PI) / 2));
            const ki = Math.max(0, (k - 0.22) / 0.78);
            shadow.volume = Math.min(v, v * fadeInGain * Math.sin((ki * Math.PI) / 2));
            if (k < 1) {
              rafRef.current = requestAnimationFrame(step);
              return;
            }
            done();
          };
          rafRef.current = requestAnimationFrame(step);
        };
        if (want > 0) {
          const t0 = performance.now();
          Promise.all([
            measureLoudness(live, want),
            measureLoudness(shadow, want),
          ])
            .then(([rmsOut, rmsIn]) => {
              // koreksi loudness lagu masuk, clamp 0.5–2.0 (±6 dB)
              const corr = Math.min(2, Math.max(0.5, rmsOut / rmsIn));
              finish(corr, performance.now() - t0);
            })
            .catch(() => finish(1, 0));
        } else {
          finish(1, 0);
        }
      };
      if (shadow.readyState >= 2) {
        startFade();
        return;
      }
      let settled = false;
      const onReady = () => {
        if (settled) return;
        settled = true;
        shadow.removeEventListener("canplay", onReady);
        clearTimeout(waitTimer);
        if (fadingRef.current) startFade();
      };
      const waitTimer = setTimeout(onReady, 2000);
      shadow.addEventListener("canplay", onReady);
    },
    [ensureShadowElement, measureLoudness, preloadNext],
  );

  // ── Putar otomatis: antrian tidak pernah habis ──────────────────────────
  // Saat lagu terakhir mendekati/berakhir, tambahkan lagu dari artis yang
  // sama (hasil pencarian) ke antrian, seperti Autoplay-nya Apple Music.
  const autoplayRef = useRef(false);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  const autoplayFromRef = useRef<number | null>(null);
  useEffect(() => {
    autoplayFromRef.current = autoplayFrom;
  }, [autoplayFrom]);
  const extendingRef = useRef(false);
  const extendedForRef = useRef<string | null>(null);

  const extendQueue = useCallback(async (): Promise<boolean> => {
    if (!autoplayRef.current || extendingRef.current) return false;
    const q = queueRef.current;
    const i = indexRef.current;
    const cur = q[i];
    if (!cur) return false;
    if (i + 1 < q.length) return true; // masih ada lagu berikutnya
    if (extendedForRef.current === cur.videoId) return false;
    const artist = cur.artist?.trim();
    if (!artist) return false;
    extendingRef.current = true;
    try {
      const res = await fetch(
        `/api/search?filter=songs&limit=20&q=${encodeURIComponent(artist)}`,
      );
      if (!res.ok) return false;
      const songs = (await res.json()) as Track[];
      const seen = new Set(q.map((x) => x.videoId));
      const extra = songs
        .filter((s) => s.videoId && !seen.has(s.videoId))
        .slice(0, 10);
      extendedForRef.current = cur.videoId;
      if (!extra.length) return false;
      const nq = [...q, ...extra];
      queueRef.current = nq;
      setQueue(nq);
      autoplayFromRef.current = q.length;
      setAutoplayFrom(q.length);
      return true;
    } catch {
      return false;
    } finally {
      extendingRef.current = false;
    }
  }, []);

  // saat lagu terakhir mulai diputar, siapkan kelanjutannya lebih awal —
  // preloadNext otomatis mem-buffer lagu pertama hasil autoplay
  useEffect(() => {
    if (!hydrated || !autoplay) return;
    if (!current || index < queue.length - 1) return;
    void extendQueue();
  }, [hydrated, autoplay, current, queue, index, extendQueue]);

  const toggleAutoplay = useCallback(() => {
    const nv = !autoplayRef.current;
    autoplayRef.current = nv;
    setAutoplay(nv);
    if (!nv) {
      setAutoplayFrom(null);
      autoplayFromRef.current = null;
    }
    toast(
      nv ? "Putar otomatis aktif — antrian tak akan habis" : "Putar otomatis dimatikan",
    );
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (!q.length) return;
    // sedang play + crossfade aktif + masih ada jeda → sambung mulus
    const live = audioRef.current;
    const canFade =
      live &&
      crossfadeRef.current &&
      !fadingRef.current &&
      !live.paused &&
      isFinite(live.duration) &&
      live.duration - live.currentTime > cfRef.current;
      if (canFade && i + 1 < q.length) {
      beginFade(q, i + 1);
      return;
    }
    if (fadingRef.current) finishFadeNow();
    if (i + 1 < q.length) startAt(q, i + 1, false);
    else if (repeatRef.current === "all") startAt(q, 0, false);
    else if (autoplayRef.current) {
      // putar otomatis: isi antrian lalu lanjut
      setResolving(true);
      setError(null);
      void extendQueue().then((ok) => {
        const nq = queueRef.current;
        const ni = indexRef.current + 1;
        if (ok && ni < nq.length) startAt(nq, ni, false);
        else {
          setResolving(false);
          const a = audioRef.current;
          if (a) a.pause();
          setPlaying(false);
        }
      });
    } else {
      const a = audioRef.current;
      if (a) {
        a.pause();
      }
      setPlaying(false);
    }
  }, [startAt, beginFade, finishFadeNow, extendQueue]);

  // ref terbaru buat handler event (hindari effect listener nggak perlu re-wire)
  const beginFadeRef = useRef(beginFade);
  useEffect(() => {
    beginFadeRef.current = beginFade;
  }, [beginFade]);
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  const repeatRef = useRef<Repeat>("off");
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const prev = useCallback(() => {
    finishFadeNow();
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const i = indexRef.current;
    if (i > 0) startAt(queueRef.current, i - 1, false);
  }, [startAt, finishFadeNow]);

  const toggle = useCallback(() => {
    const a = ensureAudio();
    if (!a.src) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, [ensureAudio]);

  const jumpTo = useCallback(
    (i: number) => {
      finishFadeNow();
      if (i >= 0 && i < queueRef.current.length) startAt(queueRef.current, i, false);
    },
    [startAt, finishFadeNow],
  );

  const enqueue = useCallback((t: Track, at?: number) => {
    // duplikat diperbolehkan (Apple Music juga): lagu boleh nunggu dua kali.
    setQueue((q) => {
      const nq = [...q];
      nq.splice(at ?? nq.length, 0, t);
      return nq;
    });
  }, []);

  // Hapus lagu sebelum lagu yang main → index harus ikut geser, kalau tidak
  // highlight "sedang diputar" pindah ke lagu yang salah.
  const removeFromQueue = useCallback((i: number) => {
    setQueue((q) => q.filter((_, j) => j !== i));
    setIndex((ci) => (i < ci ? Math.max(0, ci - 1) : ci));
  }, []);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (a && isFinite(t)) a.currentTime = t;
  }, []);

  const setVolume = useCallback((v: number) => {
    setMuted(false);
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (shadowRef.current) shadowRef.current.volume = v;
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    if (shadowRef.current) shadowRef.current.muted = a.muted;
    setMuted(a.muted);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const toggleShuffleFn = useCallback(() => {
    setShuffle((s) => {
      const q = queueRef.current;
      const i = indexRef.current;
      if (!s && q.length > 1) {
        // reshuffle upcoming tracks in place, keep current first in order
        const cur = queueRef.current[indexRef.current];
        const rest = q.filter((_, j) => j !== i);
        const nq = [cur, ...shuffled(rest)];
        setQueue(nq);
        queueRef.current = nq;
        setIndex(0);
        indexRef.current = 0;
      }
      return !s;
    });
  }, []);

  const toggleCrossfade = useCallback(() => {
    setCrossfade((c) => !c);
  }, []);

  /** putar-putar durasi crossfade: 2→4→6→8→10→12→2 … */
  const cycleCfSec = useCallback(() => {
    const cur = cfRef.current;
    const idx = CF_PRESETS.indexOf(cur);
    const nv = CF_PRESETS[(idx + 1) % CF_PRESETS.length];
    cfRef.current = nv;
    setCfSecState(nv);
    toast(`Crossfade ${nv} detik`);
  }, []);

  const setCfSec = useCallback((n: number) => {
    const nv = CF_PRESETS.includes(n) ? n : DEFAULT_CF_SEC;
    cfRef.current = nv;
    setCfSecState(nv);
  }, []);

  const toggleLike = useCallback((t: Track) => {
    setLiked((ls_) => {
      if (ls_.some((x) => x.videoId === t.videoId))
        return ls_.filter((x) => x.videoId !== t.videoId);
      return [t, ...ls_];
    });
  }, []);

  const isLiked = useCallback(
    (videoId: string) => liked.some((x) => x.videoId === videoId),
    [liked],
  );

  const createPlaylist = useCallback((name: string) => {
    const id = "pl_" + Math.random().toString(36).slice(2, 9);
    setPlaylists((ps) => [
      ...ps,
      { id, name: name.trim() || "Playlist Baru", createdAt: Date.now(), tracks: [] },
    ]);
    return id;
  }, []);

  const deletePlaylist = useCallback((pid: string) => {
    setPlaylists((ps) => ps.filter((p) => p.id !== pid));
  }, []);

  const addToPlaylist = useCallback((pid: string, t: Track) => {
    setPlaylists((ps) =>
      ps.map((p) =>
        p.id === pid
          ? { ...p, tracks: p.tracks.some((x) => x.videoId === t.videoId) ? p.tracks : [...p.tracks, t] }
          : p,
      ),
    );
  }, []);

  const removeFromPlaylist = useCallback((pid: string, videoId: string) => {
    setPlaylists((ps) =>
      ps.map((p) =>
        p.id === pid ? { ...p, tracks: p.tracks.filter((x) => x.videoId !== videoId) } : p,
      ),
    );
  }, []);

  // audio event wiring — listener dipasang ke DUA elemen (live + bayangan);
  // handler hanya nurani elemen yang sedang jadi live.
  useEffect(() => {
    const a = ensureAudio();
    const s = ensureShadowElement();
    const onPlay = (e: Event) => {
      if (e.currentTarget !== audioRef.current) return;
      setPlaying(true);
    };
    const onPause = (e: Event) => {
      const el = e.currentTarget as HTMLAudioElement;
      if (el !== audioRef.current) return;
      // pause alami di ujung lagu (fire sebelum `ended`) — bukan user menjeda;
      // kalau diperlakukan sbg pause user, bayangan yang sedang fade-in ikut
      // dijeda → musik mati pas crossfade selesai. Bug lama: fade lalu berhenti.
      if (el.ended) return;
      setPlaying(false);
      // user menjeda di tengah fade → bayangan ikut berhenti
      if (fadingRef.current && shadowRef.current) shadowRef.current.pause();
    };
    const onTime = (e: Event) => {
      const el = e.currentTarget as HTMLAudioElement;
      if (el !== audioRef.current) return; // bayangan belum jadi live
      setPosition(el.currentTime);
      positionRef.current = el.currentTime;
      pushPositionState(el);
      // ── auto-crossfade: sisa waktu tersisa ≤ 4 detik & ada lagu berikutnya ──
      if (
        crossfadeRef.current &&
        !fadingRef.current &&
        repeatRef.current !== "one" &&
        el.duration > 0 &&
        isFinite(el.duration)
      ) {
        const remain = el.duration - el.currentTime;
        if (remain > 0.2 && remain <= cfRef.current) {
          const q = queueRef.current;
          const i = indexRef.current;
          const ni =
            repeatRef.current === "all" && i + 1 >= q.length ? 0 : i + 1;
          if (ni < q.length) beginFadeRef.current(q, ni);
        }
      }
    };
    const onMeta = (e: Event) => {
      const el = e.currentTarget as HTMLAudioElement;
      // metadata bayangan hanya diterima saat crossfade berjalan (durasi UI
      // ikut lagu baru). Preload di luar fade tidak boleh menimpa durasi
      // lagu yang sedang diputar — progress bar jadi salah.
      if (el !== audioRef.current && !fadingRef.current) return;
      setDuration(el.duration || 0);
      setResolving(false);
      errCountRef.current = 0;
      setPosition(0);
      positionRef.current = 0;
      pushPositionState(el);
    };
    const onWait = () => setResolving(true);
    const onCanPlay = () => setResolving(false);
    const onError = (e: Event) => {
      const el = e.currentTarget as HTMLAudioElement;
      if (el !== audioRef.current) return; // gagal saat masih bayangan: tunggu jadi live
      setResolving(false);
      errCountRef.current += 1;
      if (errCountRef.current >= Math.max(queueRef.current.length, 1)) {
        toast("Beberapa lagu gagal diputar");
        setPlaying(false);
        return;
      }
      setError("Gagal memuat audio. Lewati ke lagu berikutnya…");
      toast("Gagal memuat audio — lewati ke lagu berikutnya…");
      setTimeout(() => nextRef.current(), 1200);
    };
    const onEnded = (e: Event) => {
      const el = e.currentTarget as HTMLAudioElement;
      if (el !== audioRef.current || fadingRef.current) return; // lagu lama pasca-swap: abaikan
      if (repeatRef.current === "one") {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else nextRef.current();
    };
    for (const el of [a, s]) {
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("loadedmetadata", onMeta);
      el.addEventListener("waiting", onWait);
      el.addEventListener("canplay", onCanPlay);
      el.addEventListener("error", onError);
      el.addEventListener("ended", onEnded);
    }
    return () => {
      for (const el of [a, s]) {
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("loadedmetadata", onMeta);
        el.removeEventListener("waiting", onWait);
        el.removeEventListener("canplay", onCanPlay);
        el.removeEventListener("error", onError);
        el.removeEventListener("ended", onEnded);
      }
    };
  }, [ensureAudio, ensureShadowElement]);

  // volume patch without recreating listeners — dua elemen sekaligus
  useEffect(() => {
    volRef.current = volume;
    for (const el of [audioRef.current, shadowRef.current]) {
      if (el && !fadingRef.current) {
        el.volume = volume;
        el.muted = muted;
      }
    }
  }, [volume, muted, current]);

  // ── Media Session: metadata + tombol di lockscreen / Control Center / headphone ──
  const positionRef = useRef(0);

  useEffect(() => {
    const ms = mediaSession();
    if (!ms || !current) return;
    ms.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist ?? "",
      album: current.album ?? "Musiku",
      artwork: current.thumbs
        ? [{ src: current.thumbs, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
  }, [current]);

  useEffect(() => {
    const ms = mediaSession();
    if (!ms) return;
    ms.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(() => {
    const ms = mediaSession();
    if (!ms) return;
    const safe = (name: MediaSessionAction, fn: MediaSessionActionHandler) => {
      try {
        ms.setActionHandler(name, fn);
      } catch {}
    };
    safe("play", () => toggle());
    safe("pause", () => toggle());
    safe("previoustrack", () => prev());
    safe("nexttrack", () => next());
    safe("seekbackward", (d) => {
      const off = d?.seekOffset ?? 10;
      seek(Math.max(positionRef.current - off, 0));
    });
    safe("seekforward", (d) => {
      const off = d?.seekOffset ?? 10;
      const dur = audioRef.current?.duration;
      seek(Math.min(positionRef.current + off, isFinite(dur ?? 0) ? dur! : positionRef.current + off));
    });
    safe("seekto", (d) => {
      // fastSeek hanya kira-kira; minta posisi pasti langsung ke track
      if (typeof d?.seekTime === "number") seek(d.seekTime);
    });
    return () => {
      for (const n of ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"] as MediaSessionAction[]) {
        safe(n, () => {});
      }
    };
  }, [toggle, prev, next, seek]);

  const pushPositionState = (a: HTMLAudioElement) => {
    const ms = mediaSession();
    if (!ms || !isFinite(a.duration) || a.duration <= 0) return;
    try {
      ms.setPositionState({
        duration: a.duration,
        playbackRate: a.playbackRate || 1,
        position: Math.min(a.currentTime, a.duration),
      });
    } catch {}
  };

  const value = useMemo(
    () => ({
      current, queue, index, playing, position, duration, shuffle, repeat,
      volume, muted, crossfade, toggleCrossfade, cfSec, cycleCfSec, setCfSec, autoplay, toggleAutoplay, autoplayFrom,
      resolving, error, liked, playlists, recent,
      playTracks, playOne, enqueue, removeFromQueue, jumpTo, toggle, next, prev,
      seek, setVolume, toggleMute, cycleRepeat, toggleShuffle: toggleShuffleFn,
      toggleLike, isLiked, createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist,
      ui, toggleUi,
    }),
    [
      current, queue, index, playing, position, duration, shuffle, repeat, volume, muted,
      crossfade, toggleCrossfade, cfSec, cycleCfSec, setCfSec, autoplay, toggleAutoplay, autoplayFrom,
      resolving, error, liked, playlists, recent, playTracks, playOne, enqueue,
      removeFromQueue, jumpTo, toggle, next, prev, seek, setVolume, toggleMute, cycleRepeat,
      toggleShuffleFn, toggleLike, isLiked, createPlaylist, deletePlaylist,
      addToPlaylist, removeFromPlaylist, ui, toggleUi,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div id="musiku-audio-mount" />
    </Ctx.Provider>
  );
}
