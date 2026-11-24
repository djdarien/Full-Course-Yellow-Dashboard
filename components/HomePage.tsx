"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatSessionWhen } from "@/lib/format";
import { describeCalendar, type RaceWeekend } from "@/lib/season";
import type { LiveStatus } from "@/lib/types";

type SeasonPayload = { races?: RaceWeekend[]; error?: string };

const PILL: Record<string, string> = {
  green: "border-[#2f9e62] text-[#9ee0b8]",
  yellow: "border-[#e2b340] text-[#f3d48a]",
  sc: "border-[#e2b340] text-[#f3d48a]",
  vsc: "border-[#e07a3d] text-[#f6c7a4]",
  red: "border-[#e23b32] text-[#f5b4ae]",
  chequered: "border-[#d9d4ca] text-[#f4f1ea]",
  neutral: "border-pit-line text-pit-muted",
};

export function HomePage() {
  const [season, setSeason] = useState<SeasonPayload | null>(null);
  const [status, setStatus] = useState<LiveStatus | null>(null);

  useEffect(() => {
    void fetch("/api/season")
      .then((response) => response.json())
      .then((body) => setSeason(body as SeasonPayload))
      .catch(() => setSeason({ error: "Season data is unavailable right now.", races: [] }));
  }, []);

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void fetch("/api/live/status")
        .then((response) => response.json())
        .then((body) => {
          if (!stop) setStatus(body as LiveStatus);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const races = season?.races ?? [];
  const calendar = races.length ? describeCalendar(races) : null;
  const featured = calendar?.featured;
  const liveWeekend = calendar?.mode === "live-weekend";
  const feedLive = Boolean(status?.active);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <p className="font-display text-sm uppercase tracking-[0.22em] text-pit-red">Live timing beside the broadcast</p>
      <div className="mt-4 grid items-end gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div>
          <h1 className="font-display text-6xl uppercase leading-[0.9] sm:text-7xl lg:text-8xl">
            {featured ? featured.name.replace(" Grand Prix", "") : "Pitwall"}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-pit-muted">
            {featured
              ? `Round ${featured.round} · ${featured.circuit} · ${featured.locality}`
              : "A pit-wall console for the session in front of you."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/live" className="bg-pit-red px-5 py-3 font-display text-2xl uppercase tracking-wide text-white hover:bg-[#c9322a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pit-red">
              Open console
            </Link>
            <span className={`border px-3 py-2 font-display text-sm uppercase tracking-wide ${feedLive ? "border-[#2f9e62] text-[#9ee0b8]" : "border-pit-line text-pit-muted"}`}>
              {status?.connection === "reconnecting" ? "Feed reconnecting" : feedLive ? "Feed live" : status ? "Feed standby" : "Checking feed"}
            </span>
          </div>
        </div>
        <aside className="border border-pit-line bg-pit-raised p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-pit-dim">{liveWeekend ? "This weekend" : calendar?.mode === "next" ? "Next round" : "Season"}</p>
          <p className="mt-2 font-display text-3xl uppercase leading-none">{status?.meeting || featured?.name || "Calendar loading"}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-1 font-display text-sm uppercase ${PILL[status?.trackTone || "neutral"]}`}>{status?.trackLabel || "No flag"}</span>
            <span className="font-mono text-sm text-pit-muted">
              {status?.lap ? `Lap ${status.lap}${status.totalLaps ? ` / ${status.totalLaps}` : ""}` : status?.sessionName || "No live session"}
            </span>
          </div>
          <ol className="mt-4 space-y-2">
            {(status?.top3 ?? []).map((driver) => (
              <li key={driver.code} className="grid grid-cols-[1.5rem_3rem_minmax(0,1fr)_auto] items-center gap-2 text-sm" style={{ boxShadow: `inset 3px 0 0 ${driver.colour}` }}>
                <span className="pl-2 font-mono">{driver.position}</span>
                <span className="font-display text-base">{driver.code}</span>
                <span className="truncate text-pit-muted">{driver.team}</span>
                <span className="font-mono text-pit-text">{driver.gap || "—"}</span>
              </li>
            ))}
            {!status?.top3?.length && <li className="text-sm text-pit-muted">The classification appears here once cars are on track.</li>}
          </ol>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-sm uppercase tracking-[0.18em] text-pit-dim">Sessions · local time</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(featured?.sessions ?? []).map((session) => (
            <article key={`${session.code}-${session.date}-${session.time}`} className="border border-pit-line bg-pit-sunken px-3 py-3">
              <p className="font-display text-2xl uppercase leading-none">{session.code}</p>
              <p className="mt-2 text-sm text-pit-text">{session.label}</p>
              <p className="mt-1 font-mono text-sm text-pit-muted">{formatSessionWhen(session.date, session.time)}</p>
            </article>
          ))}
          {!featured && !season && <p className="text-sm text-pit-muted">Loading the calendar…</p>}
          {season?.error && <p className="text-sm text-pit-muted">{season.error}</p>}
        </div>
      </section>
      <p className="mt-10 text-sm leading-relaxed text-pit-dim lg:hidden">
        Pitwall is an unofficial fan project and is not affiliated with Formula 1, the FIA, or the teams.
      </p>
    </div>
  );
}
