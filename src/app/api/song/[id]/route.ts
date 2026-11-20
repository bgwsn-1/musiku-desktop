import { NextRequest, NextResponse } from "next/server";
import { MUSIC } from "@/lib/music";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await MUSIC.song(id);
    if ((data as { error?: string }).error)
      return NextResponse.json({ error: (data as { error?: string }).error }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
