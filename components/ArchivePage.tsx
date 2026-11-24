"use client";

import { useEffect, useState } from "react";

type SessionRef = { Name?: string; Type?: string; Path?: string; StartDate?: string };
type Meeting = { Name?: string; Location?: string; Sessions?: SessionRef[] };
type Row = { position: string; code: string; number: string; team: string; gap: string; last: string; best: string; stops: string };

export function ArchivePage() {
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [path, setPath] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<{ time: string; category: string; text: string }[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/archive")
      .then((response) => response.json())
      .then((body: { locked?: boolean; message?: string; error?: string; meetings?: Meeting[] }) => {
        setLocked(Boolean(body.locked));
        setMessage(body.message || body.error || "");
        setMeetings(body.meetings ?? []);
      })
      .catch(() => setMessage("The archive could not be reached. The live console is unaffected."))
      .finally(() => setLoading(false));
  }, []);

  async function openSession(nextPath: string, label: string) {
    setPath(nextPath);
    setTitle(label);
    setRows(null);
    setNotes([]);
    const response = await fetch(`/api/archive/session?path=${encodeURIComponent(nextPath)}`);
    const body = (await response.json()) as {
      locked?: boolean;
      message?: string;
      error?: string;
      data?: Record<string, unknown>;
    };
    if (body.locked || body.error) {
      setMessage(body.message || body.error || "Session files are locked.");
      setRows([]);
      return;
    }
    const data = body.data ?? {};
    const info = data["SessionInfo.json"] as { Name?: string; Meeting?: { Name?: string } } | undefined;
    if (info?.Meeting?.Name) setTitle(`${info.Meeting.Name} · ${info.Name || label}`);
    const drivers = (data["DriverList.json"] as Record<string, { Tla?: string; TeamName?: string; RacingNumber?: string }>) || {};
    const lines = ((data["TimingData.json"] as { Lines?: Record<string, Record<string, unknown>> }) || {}).Lines || {};
    const built: Row[] = Object.keys({ ...drivers, ...lines })
      .filter((key) => /^\d+$/.test(key))
      .map((number) => {
        const line = lines[number] || {};
        const driver = drivers[number] || {};
        const last = (line.LastLapTime as { Value?: string } | undefined)?.Value || "";
        const best = (line.BestLapTime as { Value?: string } | undefined)?.Value || "";
        return {
          position: String(line.Position ?? "–"),
          code: driver.Tla || number,
          number,
          team: driver.TeamName || "",
          gap: String(line.GapToLeader ?? ""),
          last,
          best,
          stops: line.NumberOfPitStops == null ? "" : String(line.NumberOfPitStops),
        };
      })
      .sort((a, b) => Number(a.position) - Number(b.position));
    setRows(built);
    const rawMessages = (data["RaceControlMessages.json"] as { Messages?: unknown })?.Messages;
    const list = Array.isArray(rawMessages) ? rawMessages : rawMessages && typeof rawMessages === "object" ? Object.values(rawMessages) : [];
    setNotes(
      list
        .filter((item): item is { Utc?: string; Category?: string; Message?: string } => Boolean(item && typeof item === "object"))
        .map((item) => ({ time: item.Utc || "", category: item.Category || "Other", text: item.Message || "" }))
        .filter((item) => item.text)
        .slice(-40)
        .reverse(),
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="font-display text-sm uppercase tracking-[0.18em] text-pit-red">Static files</p>
      <h1 className="mt-2 font-display text-5xl uppercase leading-none">Archive</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-pit-muted">
        Past sessions come from the public static timing archive. When Formula 1 locks that host during a live session, this page stays quiet and the console keeps using the live feed.
      </p>
      {loading && <p className="mt-6 text-sm text-pit-muted">Checking the archive…</p>}
      {message && <p className="mt-6 border border-pit-line bg-pit-raised px-4 py-3 text-sm leading-relaxed">{message}</p>}
      {!locked && meetings.length > 0 && (
        <div className="mt-6 space-y-4">
          {meetings.map((meeting) => (
            <section key={`${meeting.Name}-${meeting.Location}`} className="border border-pit-line bg-pit-raised p-4">
              <h2 className="font-display text-2xl uppercase">{meeting.Name}</h2>
              <p className="text-sm text-pit-muted">{meeting.Location}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(meeting.Sessions ?? []).map((session) => (
                  <button
                    key={session.Path || session.Name}
                    type="button"
                    onClick={() => session.Path && void openSession(session.Path, session.Name || "Session")}
                    className={`border px-2 py-1 text-sm hover:border-pit-text ${path === session.Path ? "border-pit-red" : "border-pit-line"}`}
                  >
                    {session.Name || session.Type}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {rows && (
        <section className="mt-6 border border-pit-line bg-pit-raised">
          <h2 className="border-b border-pit-line px-4 py-3 font-display text-2xl uppercase">{title || "Classification"}</h2>
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-pit-muted">No classification in that file.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-[12px] uppercase tracking-wide text-pit-dim">
                <tr>
                  <th className="px-3 py-2">P</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="px-3 py-2">Gap</th>
                  <th className="px-3 py-2">Last</th>
                  <th className="px-3 py-2">Best</th>
                  <th className="px-3 py-2">Stops</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.number} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono">{row.position}</td>
                    <td className="px-3 py-2">
                      <span className="font-display uppercase">{row.code}</span>
                      <span className="ml-2 text-pit-dim">{row.number}</span>
                      <span className="ml-2 text-pit-muted">{row.team}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{row.gap || "—"}</td>
                    <td className="px-3 py-2 font-mono">{row.last || "—"}</td>
                    <td className="px-3 py-2 font-mono">{row.best || "—"}</td>
                    <td className="px-3 py-2 font-mono">{row.stops || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {notes.length > 0 && (
            <div className="border-t border-pit-line px-4 py-3">
              <h3 className="font-display text-lg uppercase">Race control</h3>
              <ul className="mt-2 space-y-2">
                {notes.map((note) => (
                  <li key={`${note.time}-${note.text}`} className="text-sm">
                    <span className="mr-2 font-mono text-xs text-pit-dim">{note.time}</span>
                    <span className="mr-2 uppercase text-pit-muted">{note.category}</span>
                    {note.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
