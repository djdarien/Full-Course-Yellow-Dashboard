"use client";

import { useEffect, useState } from "react";
import { constructorColour } from "@/lib/teams";
import type { ConstructorStanding, DriverStanding } from "@/lib/season";

export function StandingsPage() {
  const [drivers, setDrivers] = useState<DriverStanding[] | null>(null);
  const [constructors, setConstructors] = useState<ConstructorStanding[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/season")
      .then((response) => response.json())
      .then((body: { drivers?: DriverStanding[]; constructors?: ConstructorStanding[]; error?: string }) => {
        setDrivers(body.drivers ?? []);
        setConstructors(body.constructors ?? []);
        if (body.error) setError(body.error);
      })
      .catch(() => setError("Standings are unavailable right now."));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="font-display text-sm uppercase tracking-[0.18em] text-pit-red">Championship</p>
      <h1 className="mt-2 font-display text-5xl uppercase leading-none">Standings</h1>
      {error && <p className="mt-4 text-sm text-[#f5b4ae]">{error}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="border border-pit-line bg-pit-raised">
          <h2 className="border-b border-pit-line px-4 py-3 font-display text-2xl uppercase">Drivers</h2>
          {!drivers && <p className="px-4 py-4 text-sm text-pit-muted">Loading drivers…</p>}
          <table className="w-full text-left text-sm">
            <thead className="text-[12px] uppercase tracking-wide text-pit-dim">
              <tr>
                <th className="px-3 py-2 font-medium">P</th>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 text-right font-medium">Pts</th>
                <th className="px-3 py-2 text-right font-medium">Wins</th>
              </tr>
            </thead>
            <tbody>
              {(drivers ?? []).map((driver) => (
                <tr key={`${driver.number}-${driver.code}`} className="border-t border-white/5" style={{ boxShadow: `inset 3px 0 0 ${constructorColour(driver.team)}` }}>
                  <td className="px-3 py-2 font-mono">{driver.position}</td>
                  <td className="px-3 py-2">
                    <span className="font-display text-base uppercase">{driver.code}</span>
                    <span className="ml-2 text-pit-muted">{driver.name}</span>
                    <span className="mt-0.5 block text-xs text-pit-dim">{driver.team}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{driver.points}</td>
                  <td className="px-3 py-2 text-right font-mono">{driver.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="border border-pit-line bg-pit-raised">
          <h2 className="border-b border-pit-line px-4 py-3 font-display text-2xl uppercase">Constructors</h2>
          {!constructors && <p className="px-4 py-4 text-sm text-pit-muted">Loading constructors…</p>}
          <table className="w-full text-left text-sm">
            <thead className="text-[12px] uppercase tracking-wide text-pit-dim">
              <tr>
                <th className="px-3 py-2 font-medium">P</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 text-right font-medium">Pts</th>
                <th className="px-3 py-2 text-right font-medium">Wins</th>
              </tr>
            </thead>
            <tbody>
              {(constructors ?? []).map((team) => (
                <tr key={team.id} className="border-t border-white/5" style={{ boxShadow: `inset 3px 0 0 ${constructorColour(team.name)}` }}>
                  <td className="px-3 py-2 font-mono">{team.position}</td>
                  <td className="px-3 py-2">{team.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{team.points}</td>
                  <td className="px-3 py-2 text-right font-mono">{team.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
