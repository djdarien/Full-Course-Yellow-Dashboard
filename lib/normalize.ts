import { parseClock } from "@/lib/format";
import { teamColour } from "@/lib/teams";
import type {
  ConnectionState,
  DriverRow,
  FlagTone,
  LapRecord,
  LiveSnapshot,
  SectorRecord,
  SectorTone,
  Stint,
} from "@/lib/types";

type Bag = Record<string, unknown>;

export type NormalizeInput = {
  connection: ConnectionState;
  raw: Record<string, unknown>;
  lapLog: Record<string, LapRecord[]>;
  sectorLog: Record<string, SectorRecord[]>;
  positions: Record<string, { x: number; y: number }>;
  trail: { x: number; y: number }[];
  telemetry: LiveSnapshot["telemetry"];
  speedHistory: Record<string, number[]>;
  qualiBests: Record<string, { q1?: string; q2?: string; q3?: string }>;
  heartbeatAt: number | null;
  positionFeed: boolean;
  telemetryFeed: boolean;
  generatedAt: number;
};

function asRecord(value: unknown): Bag | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Bag;
  return null;
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  const record = asRecord(value);
  if (record && "Value" in record) return text(record.Value);
  return "";
}

function listFrom(value: unknown): Bag[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Bag[];
  const record = asRecord(value);
  if (!record) return [];
  return Object.keys(record)
    .filter((key) => key !== "_kf")
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => record[key])
    .filter((item) => item && typeof item === "object") as Bag[];
}

function sectorTone(sector: Bag | null | undefined, time: string): SectorTone {
  if (!sector || !time) return "none";
  const status = Number(sector.Status ?? 0);
  if (sector.OverallFastest === true || status === 2049) return "purple";
  if (sector.PersonalFastest === true || status === 2048) return "green";
  if (status === 2051) return "yellow";
  return "white";
}

function compoundLetter(compound: string): string {
  const name = compound.toUpperCase();
  if (name.startsWith("SOFT")) return "S";
  if (name.startsWith("MED")) return "M";
  if (name.startsWith("HARD")) return "H";
  if (name.startsWith("INT")) return "I";
  if (name.startsWith("WET")) return "W";
  return name.slice(0, 1) || "–";
}

function stintsOf(line: Bag | undefined): Stint[] {
  if (!line) return [];
  return listFrom(line.Stints).map((stint) => ({
    compound: text(stint.Compound).toUpperCase() || "UNK",
    laps: stint.TotalLaps == null || stint.TotalLaps === "" ? null : Number(stint.TotalLaps),
    fresh: String(stint.New).toLowerCase() === "true",
  }));
}

function speedOf(speeds: Bag | null | undefined, key: string): string {
  if (!speeds) return "";
  return text(asRecord(speeds[key])?.Value ?? speeds[key]);
}

function trackView(status: string, message: string, sessionStatus: string): LiveSnapshot["track"] {
  if (/finish|finalis|chequer/i.test(sessionStatus)) {
    return { status, message, label: "CHEQUERED", tone: "chequered" };
  }
  const msg = message.toLowerCase();
  let tone: FlagTone = "neutral";
  let label = message || "STANDBY";
  if (msg.includes("red") || status === "5") {
    tone = "red";
    label = "RED FLAG";
  } else if (msg.includes("vscending") || status === "7") {
    tone = "vsc";
    label = "VSC ENDING";
  } else if (msg.includes("vsc") || status === "6") {
    tone = "vsc";
    label = "VIRTUAL SC";
  } else if (msg.includes("sc") || status === "4") {
    tone = "sc";
    label = "SAFETY CAR";
  } else if (msg.includes("yellow") || status === "2" || status === "3") {
    tone = "yellow";
    label = "YELLOW";
  } else if (msg.includes("allclear") || msg.includes("green") || status === "1") {
    tone = "green";
    label = "GREEN";
  }
  return { status, message, label, tone };
}

function findLine(lines: unknown, number: string): Bag | undefined {
  const record = asRecord(lines);
  if (record) {
    const direct = asRecord(record[number]);
    if (direct) return direct;
    for (const value of Object.values(record)) {
      const line = asRecord(value);
      if (line && text(line.RacingNumber) === number) return line;
    }
  }
  if (Array.isArray(lines)) {
    return (lines as Bag[]).find((line) => text(line?.RacingNumber) === number);
  }
  return undefined;
}

export function normalize(input: NormalizeInput): LiveSnapshot {
  const info = asRecord(input.raw.SessionInfo);
  const meeting = asRecord(info?.Meeting);
  const country = asRecord(meeting?.Country);
  const circuit = asRecord(meeting?.Circuit);
  const sessionStatus = text(asRecord(input.raw.SessionStatus)?.Status) || text(info?.SessionStatus);
  const sessionName = text(info?.Name) || "Session";
  const sessionType = text(info?.Type) || sessionName;
  const qualiMode = /qual|shootout/i.test(`${sessionType} ${sessionName}`);

  const trackRaw = asRecord(input.raw.TrackStatus);
  const lapCount = asRecord(input.raw.LapCount);
  const clock = asRecord(input.raw.ExtrapolatedClock);
  const weatherRaw = asRecord(input.raw.WeatherData);
  const remaining = text(clock?.Remaining);

  const driverList = asRecord(input.raw.DriverList) ?? {};
  const timingLines = asRecord(asRecord(input.raw.TimingData)?.Lines) ?? {};
  const numbers = new Set<string>();
  for (const key of [...Object.keys(driverList), ...Object.keys(timingLines)]) {
    if (/^\d+$/.test(key)) numbers.add(key);
  }

  const drivers: DriverRow[] = [...numbers].map((number) => {
    const driver = asRecord(driverList[number]);
    const timing = findLine(timingLines, number) ?? asRecord(timingLines[number]);
    const app = findLine(asRecord(input.raw.TimingAppData)?.Lines, number);
    const stats = findLine(asRecord(input.raw.TimingStats)?.Lines, number);
    const stints = stintsOf(app);
    const current = stints[stints.length - 1];
    const sectors = listFrom(timing?.Sectors).slice(0, 3).map((sector) => {
      const live = text(sector.Value);
      const previous = text(sector.PreviousValue);
      const time = live || previous;
      return { time, tone: sectorTone(sector, time), live: Boolean(live) };
    });
    while (sectors.length < 3) sectors.push({ time: "", tone: "none", live: false });
    const last = asRecord(timing?.LastLapTime);
    const best = asRecord(timing?.BestLapTime);
    const interval = asRecord(timing?.IntervalToPositionAhead);
    const positionText = text(timing?.Position);
    const position = positionText ? Number(positionText) : null;
    const team = text(driver?.TeamName);
    const bests = input.qualiBests[number] ?? {};
    const speeds = asRecord(timing?.Speeds);
    const bestSpeedBag = asRecord(stats?.BestSpeeds);
    const personal = asRecord(stats?.PersonalBestLapTime);
    return {
      number,
      code: text(driver?.Tla) || number,
      first: text(driver?.FirstName),
      last: text(driver?.LastName),
      broadcast: text(driver?.BroadcastName),
      team,
      colour: teamColour(team, text(driver?.TeamColour)),
      position: position != null && Number.isFinite(position) ? position : null,
      showPosition: timing?.ShowPosition !== false,
      gap: text(timing?.GapToLeader),
      interval: text(interval?.Value ?? timing?.IntervalToPositionAhead),
      catching: interval?.Catching === true,
      lastLap: text(last?.Value),
      lastTone: sectorTone(last, text(last?.Value)),
      bestLap: text(best?.Value) || text(personal?.Value),
      bestLapNum: best?.Lap == null ? null : Number(best.Lap),
      sectors,
      compound: current?.compound || "",
      compoundLetter: current ? compoundLetter(current.compound) : "–",
      tyreAge: current?.laps ?? null,
      freshTyre: current?.fresh ?? false,
      stops: timing?.NumberOfPitStops == null ? Math.max(0, stints.length - 1) : Number(timing.NumberOfPitStops),
      inPit: timing?.InPit === true,
      pitOut: timing?.PitOut === true,
      stopped: timing?.Stopped === true,
      retired: timing?.Retired === true,
      knockedOut: timing?.KnockedOut === true,
      laps: timing?.NumberOfLaps == null ? null : Number(timing.NumberOfLaps),
      grid: app?.GridPos == null ? null : text(app.GridPos),
      speeds: {
        i1: speedOf(speeds, "I1"),
        i2: speedOf(speeds, "I2"),
        fl: speedOf(speeds, "FL"),
        st: speedOf(speeds, "ST"),
      },
      bestSpeeds: {
        i1: speedOf(bestSpeedBag, "I1"),
        i2: speedOf(bestSpeedBag, "I2"),
        fl: speedOf(bestSpeedBag, "FL"),
        st: speedOf(bestSpeedBag, "ST"),
      },
      bestSectors: listFrom(stats?.BestSectors).slice(0, 3).map((sector) => ({
        time: text(sector.Value),
        position: sector.Position == null ? null : Number(sector.Position),
      })),
      stints,
      q1: bests.q1 || "",
      q2: bests.q2 || "",
      q3: bests.q3 || "",
      lapsDone: input.lapLog[number] ?? [],
      sectorTrend: input.sectorLog[number] ?? [],
    };
  });

  drivers.sort((a, b) => {
    if (a.retired !== b.retired) return a.retired ? 1 : -1;
    const ap = a.position ?? 999;
    const bp = b.position ?? 999;
    if (ap !== bp) return ap - bp;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const session = info
    ? {
        name: sessionName,
        type: sessionType,
        meeting: text(meeting?.Name) || text(meeting?.OfficialName) || "Grand Prix",
        officialName: text(meeting?.OfficialName),
        circuit: text(circuit?.ShortName) || text(meeting?.Location),
        location: text(meeting?.Location),
        country: text(country?.Name),
        path: text(info.Path),
        status: sessionStatus || "Unknown",
        gmtOffset: text(info.GmtOffset),
      }
    : null;

  return {
    generatedAt: input.generatedAt,
    connection: input.connection,
    session,
    track: trackView(text(trackRaw?.Status), text(trackRaw?.Message), sessionStatus),
    lap: {
      current: lapCount?.CurrentLap == null ? null : Number(lapCount.CurrentLap),
      total: lapCount?.TotalLaps == null ? null : Number(lapCount.TotalLaps),
    },
    clock: {
      remaining,
      remainingSec: parseClock(remaining),
      extrapolating: clock?.Extrapolating === true,
      utc: text(clock?.Utc) || null,
    },
    heartbeatAt: input.heartbeatAt,
    weather: {
      air: text(weatherRaw?.AirTemp) || null,
      track: text(weatherRaw?.TrackTemp) || null,
      humidity: text(weatherRaw?.Humidity) || null,
      windSpeed: text(weatherRaw?.WindSpeed) || null,
      windDir: text(weatherRaw?.WindDirection) || null,
      rain: text(weatherRaw?.Rainfall) || null,
      pressure: text(weatherRaw?.Pressure) || null,
    },
    drivers,
    positions: { ...input.positions },
    trail: input.trail.slice(),
    telemetry: input.telemetry,
    speedHistory: Object.fromEntries(Object.entries(input.speedHistory).map(([key, values]) => [key, values.slice()])),
    qualiMode,
    positionFeed: input.positionFeed,
    telemetryFeed: input.telemetryFeed,
  };
}

export function statusFromSnapshot(snapshot: LiveSnapshot | null, connection: ConnectionState) {
  const top = (snapshot?.drivers ?? []).filter((driver) => driver.position && !driver.retired).slice(0, 3);
  const active = Boolean(snapshot?.session && /start|live|finish|final|end|abort/i.test(snapshot.session.status) && snapshot.drivers.length > 0);
  return {
    connection: snapshot?.connection ?? connection,
    meeting: snapshot?.session?.meeting ?? null,
    sessionName: snapshot?.session?.name ?? null,
    circuit: snapshot?.session?.circuit ?? null,
    location: snapshot?.session?.location ?? null,
    country: snapshot?.session?.country ?? null,
    sessionStatus: snapshot?.session?.status ?? null,
    trackLabel: snapshot?.track.label ?? null,
    trackTone: snapshot?.track.tone ?? "neutral",
    lap: snapshot?.lap.current ?? null,
    totalLaps: snapshot?.lap.total ?? null,
    clock: snapshot?.clock.remaining ?? null,
    heartbeatAt: snapshot?.heartbeatAt ?? null,
    updatedAt: snapshot?.generatedAt ?? null,
    top3: top.map((driver) => ({
      code: driver.code,
      team: driver.team,
      colour: driver.colour,
      gap: driver.position === 1 ? driver.gap || "LEADER" : driver.interval || driver.gap,
      position: driver.position,
    })),
    active,
  };
}
