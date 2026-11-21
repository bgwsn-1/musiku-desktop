import YTMusic from "ytmusic-api";
import type {
  AlbumDetail,
  AlbumSummary,
  ArtistDetail,
  HomeItem,
  HomeShelf,
  Lyrics,
  Track,
} from "./types";

type Thumb = { url: string; width: number; height: number };

type ArtistRef = { name: string; artistId: string | null } | null | undefined;

type SongLike = {
  videoId: string;
  name?: string;
  title?: string;
  artist?: ArtistRef | string;
  artists?: ArtistRef | string;
  album?: { name: string; albumId: string } | null;
  duration?: number | string | null;
  thumbnail?: string;
  thumbnails?: Thumb[];
};

type AlbumLike = {
  albumId: string;
  name: string;
  artist?: ArtistRef;
  year?: number | null;
  thumbnails?: Thumb[];
};

let clientPromise: Promise<YTMusic> | null = null;

function client(): Promise<YTMusic> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const yt = new YTMusic();
      await yt.initialize({
        GL: process.env.YTM_GL,
        HL: process.env.YTM_HL,
      });
      return yt;
    })().catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

/** in-memory cache: YouTube Music requests are slow-ish, serverless instances are short-lived */
const cache = new Map<string, { data: unknown; exp: number }>();
const pending = new Map<string, Promise<unknown>>();
const TTL = 10 * 60 * 1000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.data as T);
  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;

  const p = fn()
    .then((data) => {
      cache.set(key, { data, exp: Date.now() + TTL });
      return data;
    })
    .finally(() => pending.delete(key));

  pending.set(key, p);
  return p;
}

/**
 * Cover terbaik: ambil thumbnail terbesar yang ditawarkan, lalu minta CDN
 * menghasilkan resolusi ≥544px. URL thumbnail Google/YT menyimpan ukuran di
 * suffix/query — jadi thumbnail 120px yang tadinya suka blur, bisa diminta
 * besar tanpa mengarang URL baru.
 */
function thumb(thumbs?: Thumb[] | null): string | null {
  if (!thumbs?.length) return null;
  const ranked = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const best = ranked[0];
  return best?.url ? upscale(best.url, best.width ?? 0) : null;
}

/** Minta resolusi ≥544px lewat suffix ukuran CDN (sesuai host, biar aman). */
function upscale(url: string, width: number): string {
  const target = Math.min(Math.max(width, 544), 1200);
  // lh*.googleusercontent.com / ggpht: ukuran duduk di suffix `=w120-h120…`
  if (/(^|\.)googleusercontent\.com/.test(url) || /(^|\.)ggpht\.com/.test(url)) {
    return /=\w[\w-]*!?$/.test(url)
      ? url.replace(/=\w[\w-]*!?$/, `=w${target}-h${target}-l90-rj`)
      : `${url}=w${target}-h${target}-l90-rj`;
  }
  // i.ytimg.com: file jadi ukuran tetap — naikkan satu tingkat yang umum
  if (/(^|\.)ytimg\.com/.test(url)) {
    if (url.includes("/hqdefault.jpg")) return url.replace("/hqdefault.jpg", "/maxresdefault.jpg");
    return url.replace(/\/(mq|sd[a-z]*)default\.jpg\b/, "/hqdefault.jpg");
  }
  return url;
}

/** YTMusic sometimes returns an artist object, sometimes just a name string. */
function artistRef(v: ArtistRef | string): { name: string; artistId: string | null } | null {
  if (!v) return null;
  if (typeof v === "string") return { name: v, artistId: null };
  return { name: v.name, artistId: v.artistId ?? null };
}

function toTrack(s: SongLike): Track {
  const artist = artistRef(s.artist ?? s.artists ?? null);
  return {
    videoId: s.videoId,
    title: s.name ?? s.title ?? "",
    artist: artist?.name ?? null,
    artists: artist?.name ? [artist.name] : [],
    artistId: artist?.artistId ?? null,
    album: s.album?.name ?? null,
    albumId: s.album?.albumId ?? null,
    duration: s.duration ?? null,
    thumbs: s.thumbnail ?? thumb(s.thumbnails),
  };
}

function toAlbumSummary(a: AlbumLike): AlbumSummary {
  return {
    browseId: a.albumId,
    title: a.name,
    artist: a.artist?.name ? [a.artist.name] : [],
    year: a.year ? String(a.year) : null,
    thumbs: thumb(a.thumbnails),
  };
}

type RawYT = {
  constructRequest: (
    endpoint: string,
    body?: Record<string, unknown>,
  ) => Promise<unknown>;
};

type ArtistStats = {
  subscribers: string | null;
  monthlyListeners: string | null;
  avatar: string | null;
  banner: string | null;
};

/** Angka mentah dari header YouTube Music ("20.8M", "96.2M monthly audience"). */
function runText(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { runs?: Array<{ text?: string }>; simpleText?: string };
  return o.runs?.[0]?.text ?? o.simpleText ?? null;
}

/**
 * ytmusic-api membuang subscriber & monthly listener dari schema-nya, padahal
 * keduanya ada di musicImmersiveHeaderRenderer pada respons browse yang sama.
 * Jadi kita baca sekali lagi lewat request internalnya (paralel dengan getArtist).
 */
async function artistStats(
  yt: YTMusic,
  browseId: string,
): Promise<ArtistStats> {
  const empty: ArtistStats = {
    subscribers: null,
    monthlyListeners: null,
    avatar: null,
    banner: null,
  };
  try {
    const raw = (await (yt as unknown as RawYT).constructRequest("browse", {
      browseId,
    })) as {
      header?: {
        musicImmersiveHeaderRenderer?: {
          monthlyListenerCount?: unknown;
          subscriptionButton?: {
            subscribeButtonRenderer?: { subscriberCountText?: unknown };
          };
          thumbnail?: {
            musicThumbnailRenderer?: {
              thumbnail?: { thumbnails?: Thumb[] };
            };
          };
        };
      };
      microformat?: {
        microformatDataRenderer?: { thumbnail?: { thumbnails?: Thumb[] } };
      };
    };

    const h = raw.header?.musicImmersiveHeaderRenderer;
    const wide = h?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
    const square =
      raw.microformat?.microformatDataRenderer?.thumbnail?.thumbnails;

    return {
      subscribers: runText(
        h?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText,
      ),
      monthlyListeners: runText(h?.monthlyListenerCount),
      // avatar asli: crop persegi dari microformat, bukan header 2880×1200
      avatar: square?.length ? square[square.length - 1].url : null,
      banner: wide?.length ? wide[wide.length - 1].url : null,
    };
  } catch {
    return empty;
  }
}

function toArtistCard(a: {
  artistId: string;
  name: string;
  thumbnails?: Thumb[];
}): ArtistDetail {
  return {
    browseId: a.artistId,
    name: a.name,
    thumbs: thumb(a.thumbnails),
    topSongs: [],
    albums: [],
    singles: [],
  };
}

function toHomeItem(c: {
  type: "ALBUM" | "PLAYLIST" | "SONG";
  albumId?: string;
  videoId?: string;
  name: string;
  artist?: ArtistRef;
  thumbnails?: Thumb[];
}): HomeItem | null {
  if (c.type === "SONG") {
    if (!c.videoId) return null;
    return {
      title: c.name,
      videoId: c.videoId,
      browseId: null,
      artist: c.artist?.name ?? null,
      artistId: c.artist?.artistId ?? null,
      thumbs: thumb(c.thumbnails),
      kind: "song",
    };
  }
  if (c.type === "ALBUM") {
    if (!c.albumId) return null;
    return {
      title: c.name,
      videoId: null,
      browseId: c.albumId,
      artist: c.artist?.name ?? null,
      artistId: c.artist?.artistId ?? null,
      thumbs: thumb(c.thumbnails),
      kind: "album",
    };
  }
  // Playlists have no dedicated page in this app.
  return null;
}

async function search(
  q: string,
  filter = "songs",
  limit = 20,
): Promise<unknown> {
  return cached(`search:${filter}:${limit}:${q}`, async () => {
    const yt = await client();

    if (filter === "artists") {
      const r = await yt.searchArtists(q);
      return r.slice(0, limit).map(toArtistCard);
    }
    if (filter === "albums") {
      const r = await yt.searchAlbums(q);
      return r.slice(0, limit).map(toAlbumSummary);
    }
    if (filter === "videos") {
      const r = await yt.searchVideos(q);
      return r.slice(0, limit).map((v) => ({
        ...toTrack(v),
        resultType: "video",
      }));
    }
    const r = await yt.searchSongs(q);
    return r.slice(0, limit).map((s) => ({
      ...toTrack(s),
      resultType: "song",
    }));
  });
}

async function home(): Promise<HomeShelf[]> {
  return cached("home", async () => {
    const yt = await client();
    const sections = await yt.getHomeSections();
    return sections
      .map((s) => ({
        title: s.title,
        items: s.contents
          .filter((c) => c != null)
          .map((c) => toHomeItem(c))
          .filter((x): x is HomeItem => x !== null),
      }))
      .filter((s) => s.items.length > 0);
  });
}

async function album(browseId: string): Promise<AlbumDetail> {
  return cached(`album:${browseId}`, async () => {
    const yt = await client();
    const a = await yt.getAlbum(browseId);
    const tracks = a.songs.map(toTrack);
    const totalSec = a.songs.reduce((n, s) => n + (s.duration ?? 0), 0);
    return {
      browseId: a.albumId,
      title: a.name,
      artist: a.artist?.name ? [a.artist.name] : [],
      artistId: a.artist?.artistId ?? null,
      year: a.year ? String(a.year) : null,
      thumbs: thumb(a.thumbnails),
      total: tracks.length,
      duration: totalSec ? `${Math.round(totalSec / 60)} menit` : null,
      tracks,
    };
  });
}

async function artist(browseId: string): Promise<ArtistDetail> {
  return cached(`artist:${browseId}`, async () => {
    const yt = await client();
    const [a, stats] = await Promise.all([
      yt.getArtist(browseId),
      artistStats(yt, browseId),
    ]);
    return {
      browseId: a.artistId,
      name: a.name,
      desc: null,
      thumbs: thumb(a.thumbnails),
      avatar: stats.avatar,
      banner: stats.banner ?? thumb(a.thumbnails),
      topVideoId: a.topVideos?.[0]?.videoId ?? null,
      subscribers: stats.subscribers,
      monthlyListeners: stats.monthlyListeners,
      topSongs: a.topSongs.map(toTrack),
      albums: a.topAlbums.map(toAlbumSummary),
      singles: a.topSingles.map(toAlbumSummary),
    };
  });
}

async function song(videoId: string): Promise<unknown> {
  return cached(`song:${videoId}`, async () => {
    const yt = await client();
    const s = await yt.getSong(videoId);
    let related: Track[] = [];
    try {
      related = (await yt.getUpNexts(videoId)).slice(0, 25).map(toTrack);
    } catch {
      related = [];
    }
    return {
      videoId,
      title: s.name,
      thumbs: thumb(s.thumbnails),
      related,
    };
  });
}

async function fromLrclib(
  title: string,
  artist: string | null,
  duration?: number | null,
): Promise<Lyrics | null> {
  const qs = new URLSearchParams({ track_name: title });
  if (artist) qs.set("artist_name", artist);
  try {
    const res = await fetch(`https://lrclib.net/api/search?${qs}`, {
      headers: { "user-agent": "Musiku/1.0 (https://github.com/)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Array<{
      duration?: number;
      syncedLyrics?: string | null;
      plainLyrics?: string | null;
    }>;
    if (!Array.isArray(items) || !items.length) return null;

    const target = duration ?? 0;
    const score = (i: (typeof items)[number]) => {
      const diff = Math.abs((i.duration ?? 0) - target);
      return (i.syncedLyrics ? 1 : 0) * 1_000_000 - diff;
    };
    const best = [...items].sort((a, b) => score(b) - score(a))[0];
    const text = best.syncedLyrics || best.plainLyrics;
    if (!text) return null;
    return {
      text,
      synced: Boolean(best.syncedLyrics),
      source: "lrclib",
    };
  } catch {
    return null;
  }
}

async function lyrics(videoId: string): Promise<Lyrics> {
  return cached(`lyrics:${videoId}`, async () => {
    const yt = await client();

    let title: string | null = null;
    let artist: string | null = null;
    let duration: number | null = null;
    try {
      const s = await yt.getSong(videoId);
      title = s.name;
      artist = s.artist?.name ?? null;
      duration = s.duration ?? null;
    } catch {
      /* tanpa judul, LRCLIB tidak bisa dipakai */
    }

    if (title) {
      const found = await fromLrclib(title, artist, duration);
      if (found) return found;
    }

    // Sumber lirik hanya LRCLIB — tidak ada fallback YouTube Music.
    return { text: null, synced: false, source: null };
  });
}

export const MUSIC = {
  search,
  home,
  album,
  artist,
  song,
  lyrics,
};
