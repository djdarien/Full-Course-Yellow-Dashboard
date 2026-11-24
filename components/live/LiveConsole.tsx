"use client";

import { useEffect, useRef, useState } from "react";
import { playAlert, type AlertKind } from "@/components/audio";
import {
  DriverSheet,
  FlagBar,
  HoldNotice,
  RaceControl,
  StrategyList,
  TeamRadioList,
  TelemetryStrip,
  TimingTower,
  TrackMap,
  WeatherCard,
} from "@/components/live/pieces";
import { SettingsPanel, useSettings } from "@/components/settings";
import { useLive } from "@/components/useLive";
import type { LiveSnapshot } from "@/lib/types";

type Toast = { id: number; title: string; body: string };

const FLAG_KIND: Record<string, AlertKind> = {
  YELLOW: "yellow",
  "SAFETY CAR": "sc",
  "VIRTUAL SC": "vsc",
  "VSC ENDING": "green",
  "RED FLAG": "red",
  GREEN: "green",
  CHEQUERED: "chequered",
};

export function LiveConsole() {
  const settings = useSettings();
  const live = useLive(settings.delay);
  const [tab, setTab] = useState<"timing" | "map" | "radio" | "strategy">("timing");
  const [selected, setSelected] = useState<string | null>(null);
  const [followed, setFollowed] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenRc = useRef(new Set<string>());
  const prevSnap = useRef<LiveSnapshot | null>(null);
  const delayRef = useRef(settings.delay);
  const armedView = useRef(false);
  const toastId = useRef(1);

  useEffect(() => {
    const saved = localStorage.getItem("pitwall.follow");
    if (saved) setFollowed(saved);
  }, []);

  useEffect(() => {
    if (selected || !live.snapshot) return;
    const leader = live.snapshot.drivers.find((driver) => driver.position === 1);
    if (leader) setSelected(leader.number);
  }, [live.snapshot, selected]);

  useEffect(() => {
    const snapshot = live.snapshot;
    if (!snapshot) return;
    if (delayRef.current !== settings.delay) {
      delayRef.current = settings.delay;
      prevSnap.current = snapshot;
      for (const message of live.messages) seenRc.current.add(message.id);
      return;
    }
    if (!armedView.current) {
      armedView.current = true;
      prevSnap.current = snapshot;
      for (const message of live.messages) seenRc.current.add(message.id);
      return;
    }
    const previous = prevSnap.current;
    const nextToasts: Toast[] = [];
    const push = (kind: AlertKind, title: string, body: string) => {
      if (!settings.alerts[kind] || nextToasts.length >= 4) return;
      nextToasts.push({ id: toastId.current++, title, body });
      if (settings.armed && !settings.muted) playAlert(kind, settings.volume / 100);
    };
    if (previous && previous.generatedAt !== snapshot.generatedAt) {
      if (previous.track.label !== snapshot.track.label) {
        const kind = FLAG_KIND[snapshot.track.label];
        if (kind) push(kind, snapshot.track.label, snapshot.session?.meeting || "Track status changed");
      } else if (previous.session?.status !== snapshot.session?.status && /finish|final|end/i.test(snapshot.session?.status || "")) {
        push("chequered", "CHEQUERED", "Session finished");
      }
      if (followed) {
        const before = previous.drivers.find((driver) => driver.number === followed);
        const after = snapshot.drivers.find((driver) => driver.number === followed);
        if (before && after && before.position && after.position) {
          if (after.position < before.position) push("gain", `${after.code} up`, `P${before.position} to P${after.position}`);
          if (after.position > before.position) push("loss", `${after.code} down`, `P${before.position} to P${after.position}`);
        }
        if (before && after && after.bestLap && before.bestLap && after.bestLap !== before.bestLap) {
          push("personalBest", `${after.code} best`, after.bestLap);
        }
      }
    }
    for (const message of live.messages) {
      if (seenRc.current.has(message.id)) continue;
      seenRc.current.add(message.id);
      if (/PENALTY|INVESTIGATION|RETIRED/i.test(message.message)) {
        push("raceControl", message.category || "Race control", message.message);
      }
    }
    prevSnap.current = snapshot;
    if (nextToasts.length) {
      setToasts((current) => [...current, ...nextToasts].slice(-4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => !nextToasts.some((item) => item.id === toast.id)));
      }, 7000);
    }
  }, [followed, live.messages, live.snapshot, settings.alerts, settings.armed, settings.delay, settings.muted, settings.volume]);

  const snapshot = live.snapshot;
  const driver = snapshot?.drivers.find((item) => item.number === selected) ?? null;
  const showData = Boolean(snapshot) && !live.holding;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FlagBar
        snapshot={snapshot}
        viewTime={live.viewTime}
        stream={live.stream}
        delay={settings.delay}
        setDelay={settings.setDelay}
        muted={settings.muted}
        setMuted={settings.setMuted}
        armed={settings.armed}
        onEnableSound={() => {
          void settings.enableSound().catch(() => undefined);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="min-h-0 flex-1 lg:p-3">
        {!showData ? (
          <HoldNotice
            seconds={live.holdFor}
            title={live.holding ? undefined : live.stream === "closed" ? "Reconnecting" : live.stream === "connecting" ? "Linking" : "Standby"}
            body={
              live.holding
                ? undefined
                : live.stream === "connecting"
                  ? "Linking to the public timing feed."
                  : "The feed is up, but there is no session picture in the delay window yet."
            }
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3 lg:grid lg:grid-cols-[minmax(340px,430px)_minmax(0,1fr)_minmax(240px,300px)] lg:overflow-hidden">
            <div className={`${tab === "timing" ? "flex" : "hidden"} h-full min-h-0 flex-col gap-3 lg:flex`}>
              <div className="min-h-0 flex-1">
                <TimingTower
                  drivers={snapshot!.drivers}
                  quali={snapshot!.qualiMode}
                  selected={selected}
                  followed={followed}
                  onSelect={setSelected}
                  onFollow={(number) => {
                    const next = followed === number ? null : number;
                    setFollowed(next);
                    if (next) localStorage.setItem("pitwall.follow", next);
                    else localStorage.removeItem("pitwall.follow");
                  }}
                />
              </div>
              <div className="hidden lg:block">
                <StrategyList drivers={snapshot!.drivers} selected={selected} onSelect={setSelected} />
              </div>
            </div>
            <div className={`${tab === "map" ? "flex" : "hidden"} h-full min-h-0 flex-col gap-3 lg:flex`}>
              <TrackMap snapshot={snapshot!} selected={selected} onSelect={setSelected} />
              <DriverSheet driver={driver} />
              <TelemetryStrip driver={driver} snapshot={snapshot!} />
            </div>
            <div className={`${tab === "radio" ? "flex" : "hidden"} h-full min-h-0 flex-col gap-3 lg:flex`}>
              <RaceControl messages={live.messages} />
              <WeatherCard snapshot={snapshot} />
              <TeamRadioList radios={live.radios} drivers={snapshot!.drivers} sessionPath={snapshot!.session?.path || ""} />
            </div>
            <div className={`${tab === "strategy" ? "block" : "hidden"} h-full min-h-0 lg:hidden`}>
              <StrategyList drivers={snapshot!.drivers} selected={selected} onSelect={setSelected} />
            </div>
          </div>
        )}
      </div>
      <nav className="grid shrink-0 grid-cols-4 border-t border-pit-line bg-[#14161b] lg:hidden">
        {(
          [
            ["timing", "Timing"],
            ["map", "Map"],
            ["radio", "Radio"],
            ["strategy", "Strategy"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`py-3 font-display text-sm uppercase tracking-wide ${tab === id ? "text-pit-red" : "text-pit-muted"}`}>
            {label}
          </button>
        ))}
      </nav>
      <div className="pointer-events-none fixed bottom-20 right-3 z-40 flex w-[min(100%-1.5rem,20rem)] flex-col gap-2 lg:bottom-4">
        {toasts.map((toast) => (
          <div key={toast.id} className="border border-pit-line bg-pit-raised px-3 py-2 shadow-pit">
            <p className="font-display text-sm uppercase tracking-wide text-pit-red">{toast.title}</p>
            <p className="text-sm leading-snug text-pit-text">{toast.body}</p>
          </div>
        ))}
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
