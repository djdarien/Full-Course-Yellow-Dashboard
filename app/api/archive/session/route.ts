import { deepMerge } from "@/lib/merge";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILES = ["SessionInfo.json", "DriverList.json", "TimingData.json", "TimingAppData.json", "RaceControlMessages.json", "LapCount.json"] as const;

function safePath(input: string | null): string | null {
  if (!input) return null;
  const path = input.trim();
  if (!/^[0-9]{4}\/[A-Za-z0-9_./+-]+$/.test(path) || path.includes("..")) return null;
  return path.endsWith("/") ? path : `${path}/`;
}

async function readStatic(path: string, file: string): Promise<unknown> {
  const response = await fetch(`https://livetiming.formula1.com/static/${path}${file}`, {
    headers: { "User-Agent": "BestHTTP", Origin: "https://www.formula1.com" },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) return { locked: true };
  if (!response.ok) return { missing: response.status };
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    let merged: unknown = {};
    for (const line of lines) {
      try {
        merged = deepMerge(merged, JSON.parse(line));
      } catch {
        /* skip partial line */
      }
    }
    return merged;
  }
}

export async function GET(request: Request) {
  const path = safePath(new URL(request.url).searchParams.get("path"));
  if (!path) return NextResponse.json({ error: "That session path is not valid." }, { status: 400 });
  try {
    const entries = await Promise.all(FILES.map(async (file) => [file, await readStatic(path, file)] as const));
    const locked = entries.every(([, value]) => value && typeof value === "object" && (value as { locked?: boolean }).locked);
    if (locked) {
      return NextResponse.json({
        locked: true,
        message: "Those session files are locked. This usually happens while a session is live.",
      });
    }
    const data = Object.fromEntries(entries);
    return NextResponse.json({ locked: false, path, data });
  } catch {
    return NextResponse.json({
      locked: false,
      error: "The session files could not be read. The live console is unaffected.",
    });
  }
}
