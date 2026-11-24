import { parseRace, type ConstructorStanding, type DriverStanding, type RaceWeekend } from "@/lib/season";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cache = {
  at: number;
  races: RaceWeekend[];
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
};

let cache: Cache | null = null;

async function jolpica<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.jolpi.ca/ergast/f1${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`jolpica ${response.status}`);
  return (await response.json()) as T;
}

export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) {
    return NextResponse.json(cache);
  }
  try {
    const [schedule, driverBody, constructorBody] = await Promise.all([
      jolpica<{ MRData: { RaceTable: { Races: Parameters<typeof parseRace>[0][] } } }>("/current.json"),
      jolpica<{
        MRData: {
          StandingsTable: {
            StandingsLists: {
              DriverStandings: {
                position: string;
                points: string;
                wins: string;
                Driver: { code?: string; permanentNumber?: string; givenName: string; familyName: string };
                Constructors: { constructorId: string; name: string }[];
              }[];
            }[];
          };
        };
      }>("/current/driverStandings.json"),
      jolpica<{
        MRData: {
          StandingsTable: {
            StandingsLists: {
              ConstructorStandings: {
                position: string;
                points: string;
                wins: string;
                Constructor: { constructorId: string; name: string };
              }[];
            }[];
          };
        };
      }>("/current/constructorStandings.json"),
    ]);

    const races = schedule.MRData.RaceTable.Races.map(parseRace);
    const driverList = driverBody.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
    const constructorList = constructorBody.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
    cache = {
      at: Date.now(),
      races,
      drivers: driverList.map((row) => ({
        position: row.position,
        points: row.points,
        wins: row.wins,
        code: row.Driver.code || "—",
        number: row.Driver.permanentNumber || "",
        name: `${row.Driver.givenName} ${row.Driver.familyName}`,
        team: row.Constructors[0]?.name || "",
        teamId: row.Constructors[0]?.constructorId || "",
      })),
      constructors: constructorList.map((row) => ({
        position: row.position,
        points: row.points,
        wins: row.wins,
        name: row.Constructor.name,
        id: row.Constructor.constructorId,
      })),
    };
    return NextResponse.json(cache);
  } catch {
    if (cache) return NextResponse.json(cache);
    return NextResponse.json({ error: "Season data is unavailable right now.", races: [], drivers: [], constructors: [] }, { status: 200 });
  }
}
