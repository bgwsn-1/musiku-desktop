import { NextResponse } from "next/server";
import { MUSIC } from "@/lib/music";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await MUSIC.home());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
