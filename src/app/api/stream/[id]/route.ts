import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { openStream } from "@/lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** `bytes=start-end`, either side optional. Returns null when absent/unusable. */
function parseRange(header: string | null) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const start = m[1] ? Number(m[1]) : undefined;
  const end = m[2] ? Number(m[2]) : undefined;
  if (start === undefined && end === undefined) return null;
  return { start, end };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: videoId } = await params;
  if (!/^[\w-]{6,25}$/.test(videoId))
    return NextResponse.json({ error: "bad id" }, { status: 400 });

  // `?video=1` → video-only track for the artist header; default → audio
  const video = req.nextUrl.searchParams.get("video") === "1";
  const range = parseRange(req.headers.get("range"));

  let handle: Awaited<ReturnType<typeof openStream>>;
  try {
    handle = await openStream(videoId, { video, range: range ?? undefined });
  } catch (e) {
    console.error("[stream] open failed", videoId, String(e).slice(0, 300));
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 502 });
  }

  const { stream, total } = handle;
  const headers: Record<string, string> = {
    "content-type": video ? "video/mp4" : "audio/mp4",
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };

  let status = 200;

  if (range && total) {
    const start = range.start ?? 0;
    const end = Math.min(range.end ?? total - 1, total - 1);
    if (start > end) {
      stream.destroy();
      return new NextResponse(null, {
        status: 416,
        headers: { "content-range": `bytes */${total}` },
      });
    }
    status = 206;
    headers["content-range"] = `bytes ${start}-${end}/${total}`;
    headers["content-length"] = String(end - start + 1);
  } else if (total) {
    headers["content-length"] = String(total);
  }

  // Node Readable → web stream. Abort the upstream read when the client leaves.
  const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
  req.signal.addEventListener("abort", () => stream.destroy());

  return new NextResponse(body, { status, headers });
}
