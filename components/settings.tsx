"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { armAudio } from "@/components/audio";
import type { AlertKind } from "@/components/audio";

export type AlertToggles = Record<AlertKind, boolean>;

const DEFAULT_ALERTS: AlertToggles = {
  yellow: true,
  sc: true,
  vsc: true,
  red: true,
  green: true,
  chequered: true,
  raceControl: true,
  gain: true,
  loss: true,
  personalBest: true,
};

type Persisted = {
  delay: number;
  muted: boolean;
  volume: number;
  soundOn: boolean;
  alerts: AlertToggles;
  token: string;
};

type SettingsValue = Persisted & {
  ready: boolean;
  armed: boolean;
  setDelay: (delay: number) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setAlert: (kind: AlertKind, on: boolean) => void;
  setToken: (token: string) => void;
  enableSound: () => Promise<void>;
};

const KEY = "pitwall.settings.v1";
const DEFAULTS: Persisted = {
  delay: 0,
  muted: false,
  volume: 70,
  soundOn: false,
  alerts: DEFAULT_ALERTS,
  token: "",
};
const SettingsContext = createContext<SettingsValue | null>(null);

function clampDelay(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(120, Math.round(value)));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted | null>(null);
  const [armed, setArmed] = useState(false);
  const view = state ?? DEFAULTS;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        setState(DEFAULTS);
        return;
      }
      const saved = JSON.parse(raw) as Partial<Persisted>;
      setState({
        delay: clampDelay(saved.delay ?? 0),
        muted: Boolean(saved.muted),
        volume: Math.max(0, Math.min(100, Number(saved.volume ?? 70))),
        soundOn: Boolean(saved.soundOn),
        alerts: { ...DEFAULT_ALERTS, ...(saved.alerts ?? {}) },
        token: typeof saved.token === "string" ? saved.token : "",
      });
    } catch {
      setState(DEFAULTS);
    }
  }, []);

  useEffect(() => {
    if (!state) return;
    localStorage.setItem(KEY, JSON.stringify(state));
    void fetch("/api/live/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: state.token }),
    }).catch(() => undefined);
  }, [state]);

  const value = useMemo<SettingsValue>(() => ({
    ...view,
    ready: state !== null,
    armed,
    setDelay: (delay) => setState((current) => ({ ...(current ?? DEFAULTS), delay: clampDelay(delay) })),
    setMuted: (muted) => setState((current) => ({ ...(current ?? DEFAULTS), muted })),
    setVolume: (volume) => setState((current) => ({ ...(current ?? DEFAULTS), volume: Math.max(0, Math.min(100, volume)) })),
    setAlert: (kind, on) => setState((current) => {
      const base = current ?? DEFAULTS;
      return { ...base, alerts: { ...base.alerts, [kind]: on } };
    }),
    setToken: (token) => setState((current) => ({ ...(current ?? DEFAULTS), token })),
    enableSound: async () => {
      await armAudio();
      setArmed(true);
      setState((current) => ({ ...(current ?? DEFAULTS), soundOn: true, muted: false }));
    },
  }), [armed, state, view]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("Settings are unavailable");
  return value;
}

const ALERT_LABELS: { kind: AlertKind; label: string }[] = [
  { kind: "yellow", label: "Yellow flag" },
  { kind: "sc", label: "Safety car" },
  { kind: "vsc", label: "Virtual safety car" },
  { kind: "red", label: "Red flag" },
  { kind: "green", label: "Green / all clear" },
  { kind: "chequered", label: "Chequered flag" },
  { kind: "raceControl", label: "Penalty, investigation, retirement" },
  { kind: "gain", label: "Followed driver gains a place" },
  { kind: "loss", label: "Followed driver loses a place" },
  { kind: "personalBest", label: "Followed driver personal best" },
];

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  const [draft, setDraft] = useState(settings.token);
  useEffect(() => setDraft(settings.token), [settings.token, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-16" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Pitwall settings"
        className="max-h-[calc(100dvh-6rem)] w-full max-w-lg overflow-y-auto border border-pit-line bg-pit-raised p-5 shadow-pit"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-pit-red">Settings</p>
            <h2 className="font-display text-3xl uppercase leading-none">Console</h2>
          </div>
          <button type="button" onClick={onClose} className="border border-pit-line px-3 py-1 text-sm hover:border-pit-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-pit-red">
            Close
          </button>
        </div>

        <label className="mt-5 block text-sm text-pit-muted" htmlFor="delay-slider">
          TV delay · {settings.delay}s
        </label>
        <input
          id="delay-slider"
          type="range"
          min={0}
          max={120}
          step={1}
          value={settings.delay}
          onChange={(event) => settings.setDelay(Number(event.target.value))}
          className="mt-2 w-full"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {[0, 15, 30, 45, 60].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => settings.setDelay(preset)}
              className={`border px-2 py-1 font-mono text-sm ${settings.delay === preset ? "border-pit-red text-pit-text" : "border-pit-line text-pit-muted hover:border-pit-text"}`}
            >
              {preset}s
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm">Master mute</span>
          <button type="button" onClick={() => settings.setMuted(!settings.muted)} className="border border-pit-line px-3 py-1 text-sm hover:border-pit-text" aria-pressed={settings.muted}>
            {settings.muted ? "Muted" : "Sound on"}
          </button>
        </div>
        <label className="mt-3 block text-sm text-pit-muted" htmlFor="volume">
          Volume · {settings.volume}
        </label>
        <input id="volume" type="range" min={0} max={100} step={1} value={settings.volume} onChange={(event) => settings.setVolume(Number(event.target.value))} className="mt-2 w-full" />

        <ul className="mt-4 space-y-2">
          {ALERT_LABELS.map((item) => (
            <li key={item.kind} className="flex items-center justify-between gap-3 text-sm">
              <span>{item.label}</span>
              <button
                type="button"
                aria-pressed={settings.alerts[item.kind]}
                onClick={() => settings.setAlert(item.kind, !settings.alerts[item.kind])}
                className={`w-14 border px-2 py-1 font-mono text-xs ${settings.alerts[item.kind] ? "border-[#2f9e62] text-[#8ee0b2]" : "border-pit-line text-pit-dim"}`}
              >
                {settings.alerts[item.kind] ? "ON" : "OFF"}
              </button>
            </li>
          ))}
        </ul>

        <label className="mt-5 block text-sm text-pit-muted" htmlFor="f1-token">
          F1 TV subscription token
        </label>
        <input
          id="f1-token"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-2 w-full border border-pit-line bg-pit-sunken px-3 py-2 font-mono text-sm outline-none focus:border-pit-red"
          placeholder="Optional, stored only in this browser"
        />
        <p className="mt-2 text-sm leading-relaxed text-pit-muted">
          Map dots and car telemetry need your own F1 TV token. Pitwall does not provide one.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => settings.setToken(draft.trim())} className="bg-pit-red px-3 py-2 text-sm font-semibold text-white hover:bg-[#c9322a]">
            Save token
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              settings.setToken("");
            }}
            className="border border-pit-line px-3 py-2 text-sm hover:border-pit-text"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
