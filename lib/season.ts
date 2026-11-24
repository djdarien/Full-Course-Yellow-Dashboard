import { sessionInstant } from "@/lib/format";

export type SessionChip = {
  code: string;
  label: string;
  date: string;
  time?: string;
};

export type RaceWeekend = {
  round: string;
  name: string;
  date: string;
  time?: string;
  circuitId: string;
  circuit: string;
  locality: string;
  country: string;
  sessions: SessionChip[];
};

export type DriverStanding = {
  position: string;
  points: string;
  wins: string;
  code: string;
  number: string;
  name: string;
  team: string;
  teamId: string;
};

export type ConstructorStanding = {
  position: string;
  points: string;
  wins: string;
  name: string;
  id: string;
};

type JolpicaSession = { date?: string; time?: string };
type JolpicaRace = {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitId: string; circuitName: string; Location: { locality: string; country: string } };
  FirstPractice?: JolpicaSession;
  SecondPractice?: JolpicaSession;
  ThirdPractice?: JolpicaSession;
  Qualifying?: JolpicaSession;
  Sprint?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
  SprintShootout?: JolpicaSession;
};

const EXTRA: { key: keyof JolpicaRace; code: string; label: string }[] = [
  { key: "FirstPractice", code: "FP1", label: "Practice 1" },
  { key: "SecondPractice", code: "FP2", label: "Practice 2" },
  { key: "ThirdPractice", code: "FP3", label: "Practice 3" },
  { key: "SprintQualifying", code: "SQ", label: "Sprint qualifying" },
  { key: "SprintShootout", code: "SQ", label: "Sprint shootout" },
  { key: "Sprint", code: "S", label: "Sprint" },
  { key: "Qualifying", code: "Q", label: "Qualifying" },
];

export function parseRace(race: JolpicaRace): RaceWeekend {
  const sessions: SessionChip[] = [];
  for (const field of EXTRA) {
    const value = race[field.key] as JolpicaSession | undefined;
    if (value?.date) sessions.push({ code: field.code, label: field.label, date: value.date, time: value.time });
  }
  sessions.push({ code: "R", label: "Race", date: race.date, time: race.time });
  sessions.sort((a, b) => sessionInstant(a.date, a.time).getTime() - sessionInstant(b.date, b.time).getTime());
  return {
    round: race.round,
    name: race.raceName,
    date: race.date,
    time: race.time,
    circuitId: race.Circuit.circuitId,
    circuit: race.Circuit.circuitName,
    locality: race.Circuit.Location.locality,
    country: race.Circuit.Location.country,
    sessions,
  };
}

export function describeCalendar(races: RaceWeekend[], now = Date.now()) {
  const windows = races.map((race) => {
    const times = race.sessions.map((session) => sessionInstant(session.date, session.time).getTime());
    return { race, start: Math.min(...times), end: Math.max(...times) + 4 * 60 * 60 * 1000 };
  });
  const currentWindow = windows.find((item) => now >= item.start && now <= item.end) ?? null;
  const nextWindow = windows.find((item) => item.start > now) ?? null;
  const lastWindow = [...windows].reverse().find((item) => item.end < now) ?? null;
  const featured = currentWindow?.race ?? nextWindow?.race ?? lastWindow?.race ?? null;
  const mode: "live-weekend" | "next" | "done" = currentWindow ? "live-weekend" : nextWindow ? "next" : "done";
  return {
    featured,
    mode,
    nextRound: nextWindow?.race.round ?? null,
    lastRound: lastWindow?.race.round ?? null,
    currentRound: currentWindow?.race.round ?? null,
  };
}
