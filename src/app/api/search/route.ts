import { NextRequest, NextResponse } from "next/server";
import { MUSIC } from "@/lib/music";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const filter = req.nextUrl.searchParams.get("filter") || "songs";
  const limit = req.nextUrl.searchParams.get("limit") || "20";
  if (!q) return NextResponse.json({ error: "missing q" }, { status: 400 });
  if (!["songs", "videos", "artists", "albums"].includes(filter))
    return NextResponse.json({ error: "bad filter" }, { status: 400 });
  try {
    const data = await MUSIC.search(q, filter, Number(limit) || 20);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
