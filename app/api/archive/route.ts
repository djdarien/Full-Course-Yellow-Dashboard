import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "User-Agent": "BestHTTP", Origin: "https://www.formula1.com" };

export async function GET(request: Request) {
  const year = new URL(request.url).searchParams.get("year") || String(new Date().getFullYear());
  if (!/^\d{4}$/.test(year)) return NextResponse.json({ locked: false, error: "Pick a four-digit season." });
  try {
    const response = await fetch(`https://livetiming.formula1.com/static/${year}/Index.json`, {
      headers: HEADERS,
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({
        locked: true,
        message: "Formula 1 has the static archive locked, which usually means a session is live. Classification will open again afterwards. The live console does not use this archive.",
      });
    }
    if (!response.ok) {
      return NextResponse.json({
        locked: false,
        error: `The archive index returned ${response.status}. The live console is unaffected.`,
      });
    }
    const body = (await response.json()) as { Meetings?: unknown[] };
    return NextResponse.json({ locked: false, year, meetings: body.Meetings ?? [] });
  } catch {
    return NextResponse.json({
      locked: false,
      error: "The archive could not be reached. The live console is unaffected.",
    });
  }
}
