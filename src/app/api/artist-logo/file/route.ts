import { NextRequest, NextResponse } from "next/server";
import { artistLogo } from "@/lib/artistLogo";

export const dynamic = "force-dynamic";

/** Proxy byte gambar logo artis dari sumbernya (Commons/TheAudioDB).
 *  Selain menyamarkan hotlink, URL same-origin ini bikin canvas bisa
 *  membaca piksel untuk deteksi warna logo di ArtistLogoName. */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!name || name.length > 120)
    return NextResponse.json({ error: "bad name" }, { status: 400 });

  let src: string | null = null;
  try {
    src = await artistLogo(name);
  } catch {
    src = null;
  }
  if (!src) return NextResponse.json({ error: "no logo" }, { status: 404 });

  try {
    const up = await fetch(src, {
      headers: { "user-agent": "Musiku/1.0 (music web player; contact: user)" },
    });
    if (!up.ok || !up.body)
      return NextResponse.json({ error: "fetch gagal" }, { status: 502 });
    return new NextResponse(up.body, {
      headers: {
        "content-type": up.headers.get("content-type") ?? "image/png",
        "cache-control": "public, max-age=604800",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
