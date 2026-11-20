import { Quality, Ytdl, chooseFormat } from "@distube/ytdl-core";
import type { Readable } from "node:stream";
import type { VideoFormat, VideoInfo } from "@distube/ytdl-core";

/**
 * Streaming resolver. Replaces yt-dlp (Python binary) so the app can run on
 * Vercel's Node.js runtime. Signatures and PO tokens are solved in-process by
 * @distube/ytdl-core.
 *
 * Datacenter IPs (Vercel included) get "Sign in to confirm you're not a bot".
 * Setting YOUTUBE_COOKIE to the Cookie header of a signed-in YouTube session
 * makes the lookups behave like a normal browser. Accepts either a raw
 * `name=value; ...` header or a Netscape cookies.txt export.
 *
 * Bytes are read through `ytdl.download(...)`, not by fetching the format URL
 * ourselves: googlevideo rejects a bare fetch from another client (403) because
 * the URL is bound to the session headers that resolved it. The library's
 * delivery also re-resolves on an expired URL or a 403 mid-stream.
 */
function makeClient(): Ytdl {
  const cookie = process.env.YOUTUBE_COOKIE?.trim();
  if (!cookie) return new Ytdl();
  try {
    return new Ytdl({ cookie });
  } catch (e) {
    console.error("[stream] YOUTUBE_COOKIE rejected", String(e).slice(0, 200));
    return new Ytdl();
  }
}

const ytdl = makeClient();

/** resolved info lives as long as YouTube's own URLs do (a few hours) */
const MAX_TTL = 30 * 60 * 1000;
const infos = new Map<string, { info: VideoInfo; exp: number }>();
const pending = new Map<string, Promise<VideoInfo>>();

async function infoFor(videoId: string): Promise<VideoInfo> {
  const hit = infos.get(videoId);
  if (hit && hit.exp > Date.now()) return hit.info;

  const inflight = pending.get(videoId);
  if (inflight) return inflight;

  const p = ytdl
    .getInfo(videoId)
    .then((info) => {
      const exp = Math.min(Date.now() + MAX_TTL, (info.expiresAt || Infinity) - 60_000);
      infos.set(videoId, { info, exp });
      return info;
    })
    .finally(() => pending.delete(videoId));

  pending.set(videoId, p);
  return p;
}

function audioFormat(info: VideoInfo): VideoFormat | undefined {
  // Prefer m4a/AAC: plays everywhere, including Safari. Fall back to any audio.
  return chooseFormat(info.formats, {
    quality: Quality.HighestAudio,
    filter: [
      { hasAudio: true, hasVideo: false, container: "mp4" },
      { hasAudio: true, hasVideo: false },
    ],
  });
}

function videoFormat(info: VideoInfo): VideoFormat | undefined {
  // Video-only, mp4/H.264 ≤720p: light enough for an autoplaying header.
  const videoOnly = info.formats.filter(
    (f) => f.hasVideo && !f.hasAudio && !f.isDrm && !f.isOtf,
  );
  const avc = videoOnly
    .filter((f) => f.container === "mp4" && f.videoCodec?.startsWith("avc1"))
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  return (
    avc.find((f) => (f.height ?? 0) <= 720) ??
    avc[avc.length - 1] ??
    videoOnly.find((f) => f.container === "mp4") ??
    videoOnly[0]
  );
}

export type ByteRange = { start?: number; end?: number };

export type StreamHandle = {
  stream: Readable;
  format: VideoFormat;
  /** Total bytes of the format, when YouTube reports it. */
  total: number | null;
};

export async function openStream(
  videoId: string,
  options: { video?: boolean; range?: ByteRange } = {},
): Promise<StreamHandle> {
  const info = await infoFor(videoId);
  const format = options.video ? videoFormat(info) : audioFormat(info);
  if (!format) throw new Error("no playable format");

  const stream = ytdl.download(info, { format, range: options.range });
  return { stream, format, total: format.contentLength ?? null };
}
