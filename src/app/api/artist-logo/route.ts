import { NextRequest, NextResponse } from "next/server";
import { artistLogo } from "@/lib/artistLogo";

export const dynamic = "force-dynamic";

/** Logo nama (wordmark) artis — null kalau artis tidak punyanya di Wikidata. */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!name || name.length > 120)
    return NextResponse.json({ error: "bad name" }, { status: 400 });
  try {
    const url = await artistLogo(name);
    return NextResponse.json(
      { url },
      { headers: { "cache-control": "public, max-age=86400" } },
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
