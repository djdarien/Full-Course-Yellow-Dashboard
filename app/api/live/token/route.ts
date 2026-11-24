import { getHub } from "@/lib/hub";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configured: getHub().tokenConfigured() });
}

export async function POST(request: Request) {
  let body: { token?: unknown } = {};
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  if (body.token != null && typeof body.token !== "string") {
    return NextResponse.json({ error: "Token must be a string" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length > 8000) {
    return NextResponse.json({ error: "Token is too long" }, { status: 400 });
  }
  getHub().setToken(token || null);
  return NextResponse.json({ configured: Boolean(token) });
}
