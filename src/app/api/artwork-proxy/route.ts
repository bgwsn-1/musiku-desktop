import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Proxy gambar sampul dari host Google (whitelist) — dipakai kanvas kartu
 *  share yang butuh gambar same-origin supaya tidak ter-taint. */
const ALLOWED = /(^|\.)(googleusercontent\.com|ggpht\.com|ytimg\.com)$/;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (u.protocol !== "https:" || !ALLOWED.test(u.hostname))
    return NextResponse.json({ error: "host tidak diizinkan" }, { status: 400 });

  try {
    const up = await fetch(u.toString(), {
      headers: { "user-agent": "Musiku/1.0 (music web player; contact: user)" },
    });
    if (!up.ok || !up.body)
      return NextResponse.json({ error: "fetch gagal" }, { status: 502 });
    return new NextResponse(up.body, {
      headers: {
        "content-type": up.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
