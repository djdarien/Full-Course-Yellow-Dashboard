"use client";

import { useEffect, useState } from "react";
import { formatSessionWhen } from "@/lib/format";
import { describeCalendar, type RaceWeekend } from "@/lib/season";

export function SchedulePage() {
  const [races, setRaces] = useState<RaceWeekend[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/season")
      .then((response) => response.json())
      .then((body: { races?: RaceWeekend[]; error?: string }) => {
        setRaces(body.races ?? []);
        if (body.error) setError(body.error);
      })
      .catch(() => setError("Season data is unavailable right now."));
  }, []);

  const calendar = races?.length ? describeCalendar(races) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="font-display text-sm uppercase tracking-[0.18em] text-pit-red">Current season</p>
      <h1 className="mt-2 font-display text-5xl uppercase leading-none">Calendar</h1>
      <p className="mt-3 max-w-2xl text-sm text-pit-muted">Times are shown in your local timezone. The highlighted round is the one on track, otherwise the next one.</p>
      {error && <p className="mt-4 text-sm text-[#f5b4ae]">{error}</p>}
      {!races && <p className="mt-6 text-sm text-pit-muted">Loading the season…</p>}
      <ol className="mt-6 space-y-3">
        {(races ?? []).map((race) => {
          const current = calendar?.currentRound === race.round;
          const next = calendar?.nextRound === race.round;
          const last = calendar?.lastRound === race.round;
          return (
            <li key={race.round} className={`border bg-pit-raised px-4 py-3 ${current || (next && !calendar?.currentRound) ? "border-pit-red" : "border-pit-line"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl uppercase leading-none">
                  <span className="mr-2 text-pit-dim">{race.round}</span>
                  {race.name}
                </h2>
                <span className="text-xs uppercase tracking-wide text-pit-dim">{current ? "This round" : next ? "Next" : last ? "Last" : race.country}</span>
              </div>
              <p className="mt-1 text-sm text-pit-muted">
                {race.circuit} · {race.locality}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {race.sessions.map((session) => (
                  <span key={`${race.round}-${session.code}-${session.time}`} className="border border-pit-line px-2 py-1">
                    <span className="font-display text-sm uppercase">{session.code}</span>
                    <span className="ml-2 font-mono text-xs text-pit-muted">{formatSessionWhen(session.date, session.time)}</span>
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
