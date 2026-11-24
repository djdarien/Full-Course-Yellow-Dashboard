"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveCircuit } from "@/lib/circuits";
import { formatRemaining, formatUtc, heartbeatLabel, cardinal } from "@/lib/format";
import type { DriverRow, LiveSnapshot, RadioCapture, RcMessage, SectorTone } from "@/lib/types";

const TONE: Record<SectorTone, string> = {
  purple: "text-[#d38bff]",
  green: "text-[#3dd68c]",
  yellow: "text-[#f0c14a]",
  white: "text-[#f4f1ea]",
  none: "text-pit-dim",
};

const FLAG: Record<string, string> = {
  green: "border-[#2f9e62] bg-[#173528] text-[#9ee0b8]",
  yellow: "border-[#e2b340] bg-[#3a3114] text-[#f3d48a]",
  sc: "border-[#e2b340] bg-[#3a3114] text-[#f3d48a]",
  vsc: "border-[#e07a3d] bg-[#3a2614] text-[#f6c7a4]",
  red: "border-[#e23b32] bg-[#3a1818] text-[#f5b4ae]",
  chequered: "border-[#d9d4ca] bg-[#2a2d33] text-[#f4f1ea]",
  neutral: "border-pit-line bg-pit-sunken text-pit-muted",
};

export function tyreClass(letter: string) {
  if (letter === "S") return "bg-[#e23b32] text-white";
  if (letter === "M") return "bg-[#f0c14a] text-[#241c08]";
  if (letter === "H") return "bg-[#f3f0e8] text-[#241c08]";
  if (letter === "I") return "bg-[#2f9e62] text-white";
  if (letter === "W") return "bg-[#3d7ec7] text-white";
  return "bg-pit-line text-pit-text";
}

export function carState(driver: DriverRow) {
  if (driver.retired) return "RET";
  if (driver.stopped) return "STOP";
  if (driver.inPit) return "PIT";
  if (driver.pitOut) return "OUT";
  if (driver.knockedOut) return "OUT";
  return null;
}

function gapOf(driver: DriverRow) {
  if (driver.position === 1) return driver.gap && !driver.gap.startsWith("+") && driver.gap !== "0.000" ? driver.gap : "LEADER";
  return driver.gap || "—";
}

function intervalOf(driver: DriverRow) {
  if (driver.position === 1) return "—";
  return driver.interval || "—";
}

export function FlagBar({
  snapshot,
  viewTime,
  stream,
  delay,
  setDelay,
  muted,
  setMuted,
  armed,
  onEnableSound,
  onOpenSettings,
}: {
  snapshot: LiveSnapshot | null;
  viewTime: number;
  stream: "connecting" | "open" | "closed";
  delay: number;
  setDelay: (value: number) => void;
  muted: boolean;
  setMuted: (value: boolean) => void;
  armed: boolean;
  onEnableSound: () => void;
  onOpenSettings: () => void;
}) {
  const session = snapshot?.session;
  const remaining = snapshot
    ? snapshot.clock.extrapolating && snapshot.clock.remainingSec != null
      ? formatRemaining(snapshot.clock.remainingSec - (viewTime - snapshot.generatedAt) / 1000, snapshot.clock.remaining)
      : snapshot.clock.remaining || "—"
    : "—";
  const age = heartbeatLabel(snapshot?.heartbeatAt ?? null, viewTime);
  const stale = snapshot?.heartbeatAt != null && viewTime - snapshot.heartbeatAt > 8000;
  const feed = stream === "closed" ? "RECONNECTING" : snapshot?.connection === "reconnecting" ? "RECONNECTING" : stream === "connecting" ? "LINKING" : "FEED";
  return (
    <div className="shrink-0 border-b border-pit-line bg-[#14161b] px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-[10rem]">
          <p className="font-display text-[15px] uppercase leading-none tracking-wide">{session?.name || "No session"}</p>
          <p className="mt-1 text-sm text-pit-muted">{session ? `${session.meeting} · ${session.circuit}` : "Waiting for the timing feed"}</p>
        </div>
        <span className={`border px-2 py-1 font-display text-sm uppercase tracking-wide ${FLAG[snapshot?.track.tone || "neutral"]}`}>
          {snapshot?.track.label || "STANDBY"}
        </span>
        <span className="font-mono text-sm">
          Lap {snapshot?.lap.current ?? "–"}
          <span className="text-pit-dim"> / {snapshot?.lap.total ?? "–"}</span>
        </span>
        <span className="font-mono text-lg leading-none">{remaining}</span>
        <span className={`font-mono text-sm ${stale ? "text-[#f0c14a]" : "text-pit-muted"}`}>
          {feed} {age}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-pit-muted" htmlFor="tv-delay">
            TV
            <input id="tv-delay" type="range" min={0} max={120} step={1} value={delay} onChange={(event) => setDelay(Number(event.target.value))} className="w-24 sm:w-32" />
            <span className="w-10 font-mono text-pit-text">{delay}s</span>
          </label>
          {[0, 15, 30, 45, 60].map((preset) => (
            <button key={preset} type="button" onClick={() => setDelay(preset)} className={`border px-1.5 py-1 font-mono text-xs ${delay === preset ? "border-pit-red text-pit-text" : "border-pit-line text-pit-dim hover:border-pit-text"}`}>
              {preset}
            </button>
          ))}
          {!armed && (
            <button type="button" onClick={onEnableSound} className="border border-pit-red px-2 py-1 text-sm text-pit-text hover:bg-pit-red/20">
              Enable sound
            </button>
          )}
          <button type="button" aria-pressed={muted} onClick={() => setMuted(!muted)} className="border border-pit-line px-2 py-1 text-sm hover:border-pit-text">
            {muted ? "Muted" : "Mute"}
          </button>
          <button type="button" onClick={onOpenSettings} className="border border-pit-line px-2 py-1 text-sm hover:border-pit-text">
            Alerts
          </button>
        </div>
      </div>
    </div>
  );
}

export function TimingTower({
  drivers,
  quali,
  selected,
  followed,
  onSelect,
  onFollow,
}: {
  drivers: DriverRow[];
  quali: boolean;
  selected: string | null;
  followed: string | null;
  onSelect: (number: string) => void;
  onFollow: (number: string) => void;
}) {
  const showQuali = quali && drivers.some((driver) => driver.q1 || driver.q2 || driver.q3);
  return (
    <section className="flex h-full min-h-0 flex-col border border-pit-line bg-pit-raised">
      <header className="flex items-baseline justify-between border-b border-pit-line px-3 py-2">
        <h2 className="font-display text-lg uppercase tracking-wide">Timing</h2>
        <span className="font-mono text-xs text-pit-dim">{drivers.length} cars</span>
      </header>
      <div className="grid grid-cols-[2rem_4.4rem_minmax(0,1fr)_4.4rem_2rem] gap-1 px-2 py-1 text-[12px] uppercase tracking-wide text-pit-dim">
        <span>P</span>
        <span>Driver</span>
        <span>Interval</span>
        <span>Last</span>
        <span />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {drivers.length === 0 && <p className="px-3 py-6 text-sm text-pit-muted">No cars on the feed yet. The tower fills in when a session goes live.</p>}
        {drivers.map((driver) => {
          const state = carState(driver);
          const active = selected === driver.number;
          return (
            <div key={driver.number} className={`border-t border-white/5 ${active ? "bg-white/[0.05]" : ""}`} style={{ boxShadow: `inset 3px 0 0 ${driver.colour}` }}>
              <button type="button" onClick={() => onSelect(driver.number)} className="grid w-full grid-cols-[2rem_4.4rem_minmax(0,1fr)_4.4rem_2rem] items-center gap-1 px-2 py-1 text-left hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pit-red">
                <span className="font-mono text-sm">{driver.position ?? "–"}</span>
                <span className="truncate">
                  <span className="font-display text-[15px] tracking-wide">{driver.code}</span>
                  <span className="ml-1 font-mono text-xs text-pit-dim">{driver.number}</span>
                </span>
                <span className="truncate font-mono text-[13px]">
                  {intervalOf(driver)}
                  {driver.catching && driver.position !== 1 ? <span className="ml-1 text-[#3dd68c]">▲</span> : null}
                  {state && <span className="ml-2 text-[11px] tracking-wide text-[#f0c14a]">{state}</span>}
                </span>
                <span className={`font-mono text-[13px] ${TONE[driver.lastTone]}`}>{driver.lastLap || "—"}</span>
                <span className={`grid h-6 w-6 place-items-center font-display text-sm ${tyreClass(driver.compoundLetter)}`} title={`${driver.compound || "tyre"} ${driver.tyreAge ?? ""} laps`}>
                  {driver.compoundLetter}
                </span>
              </button>
              <div className="grid grid-cols-[2rem_4.4rem_minmax(0,1fr)_4.4rem_2rem] items-center gap-1 px-2 pb-1.5">
                <span />
                <span className="truncate font-mono text-[12px] text-pit-muted">{gapOf(driver)}</span>
                <span className="flex min-w-0 flex-wrap gap-x-2 font-mono text-[12px]">
                  {driver.sectors.map((sector, index) => (
                    <span key={index} className={sector.live ? TONE[sector.tone] : "text-pit-dim"}>
                      {sector.time || "–"}
                    </span>
                  ))}
                  {showQuali && <span className="text-pit-dim">{[driver.q1, driver.q2, driver.q3].filter(Boolean).join("  ") || ""}</span>}
                </span>
                <span className="font-mono text-[12px] text-pit-muted">{driver.bestLap || "—"}</span>
                <button
                  type="button"
                  aria-label={followed === driver.number ? `Unpin ${driver.code}` : `Follow ${driver.code}`}
                  aria-pressed={followed === driver.number}
                  onClick={() => onFollow(driver.number)}
                  className={`text-sm ${followed === driver.number ? "text-pit-red" : "text-pit-dim hover:text-pit-text"}`}
                >
                  {followed === driver.number ? "●" : "○"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StrategyList({ drivers, onSelect, selected }: { drivers: DriverRow[]; onSelect: (number: string) => void; selected: string | null }) {
  return (
    <section className="flex h-full min-h-[180px] flex-col border border-pit-line bg-pit-raised lg:h-[210px] lg:shrink-0">
      <header className="border-b border-pit-line px-3 py-2">
        <h2 className="font-display text-lg uppercase tracking-wide">Pits</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {drivers.length === 0 && <p className="px-3 py-4 text-sm text-pit-muted">Stints show up with the timing feed.</p>}
        {drivers.map((driver) => {
          const previous = driver.stints.length > 1 ? driver.stints[driver.stints.length - 2] : null;
          return (
            <button
              key={driver.number}
              type="button"
              onClick={() => onSelect(driver.number)}
              className={`grid w-full grid-cols-[4.2rem_2rem_minmax(0,1fr)] items-center gap-2 border-t border-white/5 px-3 py-1.5 text-left hover:bg-white/[0.04] ${selected === driver.number ? "bg-white/[0.05]" : ""}`}
              style={{ boxShadow: `inset 3px 0 0 ${driver.colour}` }}
            >
              <span className="font-display text-[15px]">{driver.code}</span>
              <span className={`grid h-6 w-6 place-items-center font-display text-sm ${tyreClass(driver.compoundLetter)}`}>{driver.compoundLetter}</span>
              <span className="truncate text-sm text-pit-muted">
                <span className="font-mono text-pit-text">{driver.tyreAge ?? "–"}</span> laps
                <span className="mx-1 text-pit-dim">·</span>
                {previous ? `last ${previous.compound.slice(0, 1)} ${previous.laps ?? "?"} laps` : "no stop yet"}
                <span className="mx-1 text-pit-dim">·</span>
                {driver.stops} stop{driver.stops === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function TrackMap({ snapshot, selected, onSelect }: { snapshot: LiveSnapshot; selected: string | null; onSelect: (number: string) => void }) {
  const hint = `${snapshot.session?.circuit ?? ""} ${snapshot.session?.location ?? ""} ${snapshot.session?.meeting ?? ""}`;
  const circuit = resolveCircuit(hint);
  const outline = circuit.points.map(([x, y]) => `${x},${y}`).join(" ");
  const dots = snapshot.drivers
    .map((driver) => ({ driver, point: snapshot.positions[driver.number] }))
    .filter((item): item is { driver: DriverRow; point: { x: number; y: number } } => Boolean(item.point));
  const bounds = useMemo(() => {
    const points = [...dots.map((item) => item.point), ...snapshot.trail];
    if (!points.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const padX = (maxX - minX) * 0.08 || 10;
    const padY = (maxY - minY) * 0.08 || 10;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [dots, snapshot.trail]);

  const project = (point: { x: number; y: number }) => {
    if (!bounds) return [0, 0];
    const nx = (point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1);
    const ny = (point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1);
    return [18 + nx * 364, 222 - ny * 200];
  };

  return (
    <section className="relative min-h-[240px] flex-1 border border-pit-line bg-pit-sunken">
      <header className="flex items-baseline justify-between px-3 py-2">
        <h2 className="font-display text-lg uppercase tracking-wide">{circuit.name}</h2>
        <span className="text-xs uppercase tracking-wide text-pit-dim">Simplified outline</span>
      </header>
      <svg viewBox="0 0 400 240" className="h-[calc(100%-2.5rem)] w-full">
        <polyline points={outline} fill="none" stroke="#3c424d" strokeWidth={snapshot.positionFeed ? 8 : 14} strokeLinejoin="round" strokeLinecap="round" transform="translate(90 50) scale(1.05)" opacity={snapshot.positionFeed ? 0.35 : 1} />
        <polyline points={outline} fill="none" stroke="#b7b2a8" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" transform="translate(90 50) scale(1.05)" opacity={snapshot.positionFeed ? 0.4 : 0.9} />
        {snapshot.positionFeed && bounds && (
          <polyline points={snapshot.trail.map((point) => project(point).join(",")).join(" ")} fill="none" stroke="#6d7380" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {snapshot.positionFeed &&
          dots
            .slice()
            .sort((a, b) => Number(a.driver.number === selected) - Number(b.driver.number === selected))
            .map(({ driver, point }) => {
              const [x, y] = project(point);
              const on = driver.number === selected;
              return (
                <g key={driver.number} onClick={() => onSelect(driver.number)} className="cursor-pointer">
                  <circle cx={x} cy={y} r={on ? 8 : 5} fill={driver.colour} stroke={on ? "#f4f1ea" : "#12141a"} strokeWidth={on ? 2 : 1} />
                  <text x={x + 8} y={y + 3} fill="#f4f1ea" fontSize="9" fontFamily="ui-monospace, monospace">
                    {driver.number}
                  </text>
                </g>
              );
            })}
      </svg>
      {!snapshot.positionFeed && (
        <p className="pointer-events-none absolute inset-x-6 bottom-4 text-sm leading-relaxed text-pit-muted">
          Car dots stay empty until position data arrives. That feed needs your own F1 TV token — Pitwall does not provide one. Timing still runs.
        </p>
      )}
    </section>
  );
}

export function TelemetryStrip({ driver, snapshot }: { driver: DriverRow | null; snapshot: LiveSnapshot }) {
  const sample = driver ? snapshot.telemetry[driver.number] : undefined;
  const history = driver ? snapshot.speedHistory[driver.number] ?? [] : [];
  const quiet = !snapshot.telemetryFeed || !sample;
  return (
    <section className="border border-pit-line bg-pit-raised px-3 py-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg uppercase tracking-wide">Telemetry {driver ? driver.code : ""}</h2>
        {sample?.drs != null && <span className="font-mono text-xs text-pit-muted">DRS {sample.drs >= 8 ? "ON" : sample.drs > 0 ? "AVAIL" : "OFF"}</span>}
      </div>
      {quiet || !sample ? (
        <p className="py-3 text-sm leading-relaxed text-pit-muted">Telemetry is quiet. Car data needs your own F1 TV token, and Pitwall does not provide one.</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Stat label="Speed" value={sample.speed != null ? String(Math.round(sample.speed)) : "—"} />
          <Stat label="Gear" value={sample.gear != null ? String(sample.gear) : "—"} />
          <Stat label="RPM" value={sample.rpm != null ? Math.round(sample.rpm).toLocaleString() : "—"} />
          <Bar label="Throttle" value={sample.throttle} />
          <Bar label="Brake" value={sample.brake} />
          <Spark values={history} />
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-wide text-pit-dim">{label}</p>
      <p className="font-mono text-lg leading-tight">{value}</p>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number | null }) {
  const amount = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <p className="text-[12px] uppercase tracking-wide text-pit-dim">{label}</p>
      <div className="mt-2 h-2 bg-pit-sunken">
        <div className="h-full bg-pit-red" style={{ width: `${amount}%` }} />
      </div>
      <p className="mt-1 font-mono text-sm">{value == null ? "—" : Math.round(amount)}</p>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const path = useMemo(() => {
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 28 - ((value - min) / (max - min || 1)) * 26;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);
  return (
    <div>
      <p className="text-[12px] uppercase tracking-wide text-pit-dim">Speed trace</p>
      {path ? <svg viewBox="0 0 100 30" className="mt-1 h-9 w-full"><path d={path} fill="none" stroke="#e23b32" strokeWidth="1.6" /></svg> : <p className="mt-2 text-sm text-pit-dim">—</p>}
    </div>
  );
}

export function DriverSheet({ driver }: { driver: DriverRow | null }) {
  if (!driver) {
    return (
      <section className="border border-pit-line bg-pit-raised px-3 py-3">
        <h2 className="font-display text-lg uppercase">Driver</h2>
        <p className="mt-2 text-sm text-pit-muted">Select a row in the tower.</p>
      </section>
    );
  }
  return (
    <section className="max-h-44 overflow-y-auto border border-pit-line bg-pit-raised px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl uppercase leading-none">
          {driver.first} {driver.last}
        </h2>
        <p className="text-sm text-pit-muted">{driver.team} · grid {driver.grid || "–"}</p>
      </div>
      <div className="mt-2 grid gap-3 lg:grid-cols-3">
        <div>
          <p className="text-[12px] uppercase tracking-wide text-pit-dim">Recent laps</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {driver.lapsDone.length === 0 && <span className="text-sm text-pit-dim">No completed laps yet</span>}
            {driver.lapsDone.slice(-8).map((lap) => (
              <span key={`${lap.lap}-${lap.time}`} className={`font-mono text-[13px] ${TONE[lap.tone]}`}>
                {lap.time}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-wide text-pit-dim">Sectors</p>
          <p className="mt-1 font-mono text-[13px]">
            {driver.bestSectors.map((sector) => sector.time || "–").join("  ") || "—"}
            <span className="ml-2 text-pit-dim">best</span>
          </p>
          <div className="mt-1 space-y-0.5">
            {driver.sectorTrend.slice(-4).map((row, index) => (
              <p key={index} className="font-mono text-[12px] text-pit-muted">
                {row.s1 || "–"} · {row.s2 || "–"} · {row.s3 || "–"}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-wide text-pit-dim">Speed trap / best lap</p>
          <p className="mt-1 font-mono text-sm">
            ST {driver.speeds.st || "—"} <span className="text-pit-dim">best {driver.bestSpeeds.st || "—"}</span>
          </p>
          <p className="font-mono text-sm text-pit-muted">
            Best {driver.bestLap || "—"} {driver.bestLapNum ? `L${driver.bestLapNum}` : ""}
          </p>
          <p className="font-mono text-[12px] text-pit-dim">
            I1 {driver.speeds.i1 || "—"} · I2 {driver.speeds.i2 || "—"} · FL {driver.speeds.fl || "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

export function WeatherCard({ snapshot }: { snapshot: LiveSnapshot | null }) {
  const weather = snapshot?.weather;
  const items = [
    ["Air", weather?.air ? `${weather.air}°` : "—"],
    ["Track", weather?.track ? `${weather.track}°` : "—"],
    ["Humidity", weather?.humidity ? `${weather.humidity}%` : "—"],
    ["Wind", weather?.windSpeed ? `${weather.windSpeed} ${cardinal(weather.windDir)}` : "—"],
    ["Rain", weather?.rain ?? "—"],
    ["Pressure", weather?.pressure ?? "—"],
  ];
  return (
    <section className="border border-pit-line bg-pit-raised p-3">
      <h2 className="font-display text-lg uppercase tracking-wide">Weather</h2>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[12px] uppercase tracking-wide text-pit-dim">{label}</dt>
            <dd className="font-mono text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function categoryClass(category: string, flag: string | null) {
  const blob = `${category} ${flag ?? ""}`.toLowerCase();
  if (blob.includes("penalt")) return "text-[#f5b4ae]";
  if (blob.includes("invest")) return "text-[#f6c7a4]";
  if (blob.includes("flag") || blob.includes("yellow") || blob.includes("red") || blob.includes("green") || blob.includes("sc")) return "text-[#f3d48a]";
  return "text-pit-muted";
}

export function RaceControl({ messages }: { messages: RcMessage[] }) {
  const list = messages.slice().reverse();
  return (
    <section className="flex min-h-[180px] flex-1 flex-col border border-pit-line bg-pit-raised">
      <header className="border-b border-pit-line px-3 py-2">
        <h2 className="font-display text-lg uppercase tracking-wide">Race control</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && <p className="px-3 py-4 text-sm text-pit-muted">No messages in this window.</p>}
        {list.map((message) => (
          <article key={message.id} className="border-t border-white/5 px-3 py-2">
            <p className="flex gap-2 text-[12px] uppercase tracking-wide">
              <span className="font-mono text-pit-dim">{formatUtc(message.utc)}</span>
              <span className={categoryClass(message.category, message.flag)}>{message.category}</span>
              {message.lap != null && <span className="text-pit-dim">L{message.lap}</span>}
            </p>
            <p className="mt-1 text-sm leading-snug">{message.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TeamRadioList({ radios, drivers, sessionPath }: { radios: RadioCapture[]; drivers: DriverRow[]; sessionPath: string }) {
  const ordered = radios.slice().reverse();
  return (
    <section className="flex h-[200px] shrink-0 flex-col border border-pit-line bg-pit-raised">
      <header className="border-b border-pit-line px-3 py-2">
        <h2 className="font-display text-lg uppercase tracking-wide">Team radio</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ordered.length === 0 && <p className="px-3 py-4 text-sm text-pit-muted">No radio captures in this window.</p>}
        {ordered.map((radio) => {
          const driver = drivers.find((item) => item.number === radio.number);
          const url = sessionPath ? `https://livetiming.formula1.com/static/${sessionPath}${radio.path}` : "";
          return <RadioRow key={radio.id} radio={radio} code={driver?.code || radio.number} url={url} />;
        })}
      </div>
    </section>
  );
}

function RadioRow({ radio, code, url }: { radio: RadioCapture; code: string; url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "playing" | "unavailable">("idle");
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    const fail = () => setState("unavailable");
    audio.addEventListener("error", fail);
    audio.addEventListener("ended", () => setState("idle"));
    return () => {
      audio.pause();
      audio.removeEventListener("error", fail);
    };
  }, []);
  return (
    <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] uppercase">{code}</p>
        <p className="font-mono text-[12px] text-pit-dim">{formatUtc(radio.utc)}</p>
      </div>
      {state === "unavailable" ? (
        <span className="text-xs text-pit-dim">Clip unavailable</span>
      ) : (
        <button
          type="button"
          className="border border-pit-line px-2 py-1 text-sm hover:border-pit-text"
          onClick={() => {
            const audio = audioRef.current;
            if (!audio || !url) {
              setState("unavailable");
              return;
            }
            if (state === "playing") {
              audio.pause();
              setState("idle");
              return;
            }
            audio.src = url;
            void audio.play().then(() => setState("playing")).catch(() => setState("unavailable"));
          }}
        >
          {state === "playing" ? "Stop" : "Play"}
        </button>
      )}
    </div>
  );
}

export function HoldNotice({ seconds, title, body }: { seconds: number; title?: string; body?: string }) {
  return (
    <div className="grid h-full min-h-[240px] place-items-center p-6 text-center">
      <div>
        <p className="font-display text-4xl uppercase">{title || "Holding"}</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-pit-muted">
          {body ||
            `TV delay is buffering the console. The first delayed picture is about ${seconds}s away. Timing, flags, radio, weather, and telemetry move together.`}
        </p>
      </div>
    </div>
  );
}
