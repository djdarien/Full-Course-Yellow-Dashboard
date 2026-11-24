import WebSocket from "ws";
import { inflatePayload } from "@/lib/inflate";
import { deepMerge } from "@/lib/merge";
import { normalize, statusFromSnapshot } from "@/lib/normalize";
import { LIVE_TOPICS } from "@/lib/topics";
import type { ConnectionState, LiveSnapshot, LiveStatus, RadioCapture, RcMessage, SectorTone, TimedSnapshot } from "@/lib/types";

const RECORD = "\u001e";
const HISTORY_MS = 125_000;

type Listener = (event: HubEvent) => void;

export type HubEvent =
  | { type: "snapshot"; t: number; snapshot: LiveSnapshot }
  | { type: "rc"; message: RcMessage }
  | { type: "radio"; radio: RadioCapture };

type Telemetry = LiveSnapshot["telemetry"][string];

function toneOf(last: { OverallFastest?: boolean; PersonalFastest?: boolean; Status?: number } | undefined, time: string): SectorTone {
  if (!time) return "none";
  const status = Number(last?.Status ?? 0);
  if (last?.OverallFastest || status === 2049) return "purple";
  if (last?.PersonalFastest || status === 2048) return "green";
  if (status === 2051) return "yellow";
  return "white";
}

function asMessages(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const messages = (payload as { Messages?: unknown }).Messages ?? payload;
  if (Array.isArray(messages)) return messages.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  if (messages && typeof messages === "object") {
    return Object.values(messages).filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  }
  return [];
}

async function negotiate(token: string | null): Promise<{ cookie: string; connectionToken: string }> {
  const headers: Record<string, string> = {
    Origin: "https://www.formula1.com",
    "User-Agent": "BestHTTP",
  };
  let url = "https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    url += `&access_token=${encodeURIComponent(token)}`;
  }
  const response = await fetch(url, { method: "POST", headers, cache: "no-store" });
  if (!response.ok) throw new Error(`negotiate ${response.status}`);
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const cookie = cookies.map((item) => item.split(";")[0]).join("; ");
  if (!cookie) throw new Error("negotiate missing cookie");
  const body = (await response.json()) as { connectionToken?: string };
  if (!body.connectionToken) throw new Error("negotiate missing connection");
  return { cookie, connectionToken: body.connectionToken };
}

export class Hub {
  readonly version = 2;
  private connection: ConnectionState = "connecting";
  private token: string | null = null;
  private gen = 0;
  private stopped = false;
  private attempt = 0;
  private ws: WebSocket | null = null;
  private buffer = "";
  private ping: NodeJS.Timeout | null = null;
  private watchdog: NodeJS.Timeout | null = null;
  private emitTimer: NodeJS.Timeout | null = null;
  private lastEmit = 0;
  private lastHistory = 0;
  private lastMessageAt = 0;
  private dirtyUrgent = false;
  private raw: Record<string, unknown> = {};
  private lapLog: Record<string, { lap: number; time: string; tone: SectorTone }[]> = {};
  private sectorLog: Record<string, { s1: string; s2: string; s3: string }[]> = {};
  private lastLapValue = new Map<string, string>();
  private positions: Record<string, { x: number; y: number }> = {};
  private trail: { x: number; y: number }[] = [];
  private lastTrail: Record<string, { x: number; y: number }> = {};
  private telemetry: LiveSnapshot["telemetry"] = {};
  private speedHistory: Record<string, number[]> = {};
  private qualiBests: Record<string, { q1?: string; q2?: string; q3?: string }> = {};
  private qualiPart: number | null = null;
  private heartbeatAt: number | null = null;
  private positionFeed = false;
  private telemetryFeed = false;
  private seenRc = new Set<string>();
  private seenRadio = new Set<string>();
  messages: RcMessage[] = [];
  radios: RadioCapture[] = [];
  private history: TimedSnapshot[] = [];
  private latest: LiveSnapshot | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    this.watchdog = setInterval(() => this.checkWatchdog(), 5000);
    void this.connect();
  }

  stop() {
    this.stopped = true;
    this.gen += 1;
    this.clearSocket();
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.emitTimer) clearTimeout(this.emitTimer);
  }

  setToken(token: string | null) {
    const next = token && token.trim() ? token.trim() : null;
    if (next === this.token) return;
    this.token = next;
    this.attempt = 0;
    void this.connect();
  }

  tokenConfigured() {
    return Boolean(this.token);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getBootstrap() {
    const history = this.history.slice();
    if (this.latest) {
      const last = history[history.length - 1];
      if (!last || last.t !== this.latest.generatedAt) {
        history.push({ t: this.latest.generatedAt, snapshot: this.latest });
      }
    }
    return {
      history,
      messages: this.messages,
      radios: this.radios,
      connection: this.connection,
    };
  }

  getStatus(): LiveStatus {
    return statusFromSnapshot(this.latest, this.connection);
  }

  private async connect() {
    if (this.stopped) return;
    const gen = ++this.gen;
    this.clearSocket();
    this.connection = this.latest ? "reconnecting" : "connecting";
    this.scheduleEmit(true);
    try {
      const negotiated = await negotiate(this.token);
      if (gen !== this.gen || this.stopped) return;
      this.openSocket(gen, negotiated.cookie, negotiated.connectionToken);
    } catch {
      if (gen !== this.gen || this.stopped) return;
      console.log("[pitwall] connection failed");
      this.scheduleRetry(gen);
    }
  }

  private openSocket(gen: number, cookie: string, connectionToken: string) {
    const wsUrl = new URL("wss://livetiming.formula1.com/signalrcore");
    wsUrl.searchParams.set("id", connectionToken);
    const headers: Record<string, string> = {
      Cookie: cookie,
      Origin: "https://www.formula1.com",
      "User-Agent": "BestHTTP",
    };
    if (this.token) {
      wsUrl.searchParams.set("access_token", this.token);
      headers.Authorization = `Bearer ${this.token}`;
    }
    const ws = new WebSocket(wsUrl, { headers });
    this.ws = ws;
    this.buffer = "";
    ws.on("open", () => {
      if (gen !== this.gen) return;
      ws.send(JSON.stringify({ protocol: "json", version: 1 }) + RECORD);
    });
    ws.on("message", (data) => {
      if (gen !== this.gen) return;
      this.lastMessageAt = Date.now();
      this.buffer += data.toString();
      const parts = this.buffer.split(RECORD);
      this.buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part.trim()) this.handleFrame(part, ws);
      }
    });
    ws.on("error", () => {
      if (gen === this.gen) console.log("[pitwall] socket error");
    });
    ws.on("close", () => {
      if (gen !== this.gen || this.stopped) return;
      console.log("[pitwall] socket closed");
      this.scheduleRetry(gen);
    });
    this.ping = setInterval(() => {
      if (this.ws === ws && ws.readyState === WebSocket.OPEN) ws.send(`{"type":6}${RECORD}`);
    }, 15000);
  }

  private handleFrame(part: string, ws: WebSocket) {
    let message: {
      type?: number;
      target?: string;
      invocationId?: string;
      result?: Record<string, unknown>;
      arguments?: unknown[];
      error?: string;
    };
    try {
      message = JSON.parse(part) as typeof message;
    } catch {
      console.log("[pitwall] ignored malformed frame");
      return;
    }
    if (message.type === 6) {
      if (ws.readyState === WebSocket.OPEN) ws.send(`{"type":6}${RECORD}`);
      return;
    }
    if (message.type === 7) {
      ws.close();
      return;
    }
    if (message.type === undefined && message.target === undefined) {
      ws.send(JSON.stringify({ type: 1, invocationId: "1", target: "Subscribe", arguments: [LIVE_TOPICS] }) + RECORD);
      return;
    }
    if (message.type === 3) {
      if (message.error) {
        console.log("[pitwall] subscribe rejected");
        return;
      }
      if (message.result && typeof message.result === "object") {
        for (const [topic, payload] of Object.entries(message.result)) this.ingest(topic, payload);
      }
      this.connection = "live";
      this.attempt = 0;
      this.scheduleEmit(true);
      console.log("[pitwall] live feed subscribed");
      return;
    }
    if (message.type === 1 && message.target === "feed" && Array.isArray(message.arguments)) {
      const [topic, payload] = message.arguments;
      if (typeof topic === "string") this.ingest(topic, payload);
    }
  }

  private ingest(topic: string, payload: unknown) {
    try {
      if (topic === "Position.z" || topic === "CarData.z") {
        const data = typeof payload === "string" ? inflatePayload(payload) : payload;
        if (topic === "Position.z") this.readPositions(data);
        else this.readCars(data);
        this.scheduleEmit(false);
        return;
      }
      if (topic === "RaceControlMessages") {
        this.readMessages(payload);
        this.scheduleEmit(true);
        return;
      }
      if (topic === "TeamRadio") {
        this.readRadios(payload);
        this.scheduleEmit(false);
        return;
      }
      if (payload && typeof payload === "object" && (payload as { _kf?: boolean })._kf === true) {
        this.raw[topic] = payload;
      } else {
        this.raw[topic] = deepMerge(this.raw[topic], payload);
      }
      if (topic === "TimingData") this.noteLaps();
      if (topic === "SessionData") this.noteQuali(payload);
      if (topic === "Heartbeat") this.heartbeatAt = Date.now();
      const urgent = topic === "TrackStatus" || topic === "SessionStatus" || topic === "SessionInfo";
      this.scheduleEmit(urgent);
    } catch {
      console.log("[pitwall] dropped", topic);
    }
  }

  private readMessages(payload: unknown) {
    const now = Date.now();
    for (const message of asMessages(payload)) {
      const text = typeof message.Message === "string" ? message.Message : "";
      if (!text) continue;
      const utc = typeof message.Utc === "string" ? message.Utc : "";
      const id = `${utc}|${message.Lap ?? ""}|${text}`;
      if (this.seenRc.has(id)) continue;
      this.seenRc.add(id);
      const item: RcMessage = {
        id,
        t: now,
        utc,
        lap: message.Lap == null ? null : Number(message.Lap),
        category: typeof message.Category === "string" ? message.Category : "Other",
        flag: typeof message.Flag === "string" ? message.Flag : null,
        message: text,
        sector: message.Sector == null ? null : Number(message.Sector),
        scope: typeof message.Scope === "string" ? message.Scope : null,
      };
      this.messages.push(item);
      this.fanout({ type: "rc", message: item });
    }
    if (this.messages.length > 400) this.messages.splice(0, this.messages.length - 400);
  }

  private readRadios(payload: unknown) {
    const captures = payload && typeof payload === "object" ? (payload as { Captures?: unknown }).Captures : null;
    if (!Array.isArray(captures)) return;
    const now = Date.now();
    for (const capture of captures) {
      if (!capture || typeof capture !== "object") continue;
      const record = capture as { Utc?: string; RacingNumber?: string | number; Path?: string };
      if (!record.Path) continue;
      const number = String(record.RacingNumber ?? "");
      const utc = record.Utc ?? "";
      const id = `${utc}|${number}|${record.Path}`;
      if (this.seenRadio.has(id)) continue;
      this.seenRadio.add(id);
      const item: RadioCapture = { id, t: now, utc, number, path: record.Path };
      this.radios.push(item);
      this.fanout({ type: "radio", radio: item });
    }
    if (this.radios.length > 200) this.radios.splice(0, this.radios.length - 200);
  }

  private noteLaps() {
    const lines = (this.raw.TimingData as { Lines?: Record<string, unknown> } | undefined)?.Lines;
    if (!lines) return;
    for (const [number, value] of Object.entries(lines)) {
      if (!/^\d+$/.test(number) || !value || typeof value !== "object") continue;
      const line = value as {
        LastLapTime?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean; Status?: number };
        NumberOfLaps?: number;
        Sectors?: unknown;
      };
      const lapTime = line.LastLapTime?.Value || "";
      if (!lapTime || this.lastLapValue.get(number) === lapTime) continue;
      this.lastLapValue.set(number, lapTime);
      const lap = Number(line.NumberOfLaps) || (this.lapLog[number]?.length ?? 0) + 1;
      const record = { lap, time: lapTime, tone: toneOf(line.LastLapTime, lapTime) };
      this.lapLog[number] = [...(this.lapLog[number] ?? []), record].slice(-16);
      const rawSectors = line.Sectors;
      const sectors = Array.isArray(rawSectors)
        ? rawSectors
        : rawSectors && typeof rawSectors === "object"
          ? Object.keys(rawSectors as object)
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => (rawSectors as Record<string, unknown>)[key])
          : [];
      const read = (index: number) => {
        const sector = sectors[index] as { Value?: string; PreviousValue?: string } | undefined;
        return sector?.Value || sector?.PreviousValue || "";
      };
      this.sectorLog[number] = [...(this.sectorLog[number] ?? []), { s1: read(0), s2: read(1), s3: read(2) }].slice(-10);
    }
  }

  private noteQuali(payload: unknown) {
    const series =
      (payload as { Series?: unknown } | null)?.Series ??
      (this.raw.SessionData as { Series?: unknown } | undefined)?.Series;
    if (!Array.isArray(series)) return;
    let part: number | null = null;
    for (const item of series) {
      if (item && typeof item === "object" && typeof (item as { QualifyingPart?: number }).QualifyingPart === "number") {
        part = (item as { QualifyingPart: number }).QualifyingPart;
      }
    }
    if (part == null) return;
    if (this.qualiPart != null && part > this.qualiPart) this.freezeQuali(this.qualiPart);
    this.qualiPart = part;
  }

  private freezeQuali(part: number) {
    const lines = (this.raw.TimingData as { Lines?: Record<string, { BestLapTime?: { Value?: string } }> } | undefined)?.Lines ?? {};
    const slot = part <= 1 ? "q1" : part === 2 ? "q2" : "q3";
    for (const [number, line] of Object.entries(lines)) {
      if (!/^\d+$/.test(number)) continue;
      const best = line?.BestLapTime?.Value;
      if (!best) continue;
      this.qualiBests[number] = { ...this.qualiBests[number], [slot]: best };
    }
  }

  private readPositions(data: unknown) {
    const root = data as { Position?: unknown; Entries?: unknown } | null;
    const frames = Array.isArray(root?.Position) ? root.Position : [root?.Position ?? root];
    let found = false;
    for (const frame of frames) {
      if (!frame || typeof frame !== "object") continue;
      const entries = (frame as { Entries?: unknown }).Entries;
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue;
      for (const [number, value] of Object.entries(entries as Record<string, { X?: number; Y?: number }>)) {
        if (!/^\d+$/.test(number)) continue;
        const x = value?.X;
        const y = value?.Y;
        if (typeof x !== "number" || typeof y !== "number") continue;
        this.positions[number] = { x, y };
        found = true;
        const previous = this.lastTrail[number];
        if (previous) {
          const dx = x - previous.x;
          const dy = y - previous.y;
          if (dx * dx + dy * dy < 4) continue;
        }
        this.lastTrail[number] = { x, y };
        this.trail.push({ x, y });
      }
    }
    if (this.trail.length > 800) this.trail.splice(0, this.trail.length - 800);
    if (found) this.positionFeed = true;
  }

  private readCars(data: unknown) {
    const root = data as { Entries?: unknown } | null;
    const frames = Array.isArray(root?.Entries) ? root.Entries : [root];
    let found = false;
    for (const frame of frames) {
      if (!frame || typeof frame !== "object") continue;
      const cars = (frame as { Cars?: unknown }).Cars ?? (frame as { Entries?: unknown }).Entries;
      if (!cars || typeof cars !== "object" || Array.isArray(cars)) continue;
      for (const [number, value] of Object.entries(cars as Record<string, { Channels?: Record<string, number> }>)) {
        if (!/^\d+$/.test(number)) continue;
        const channels = value?.Channels ?? (value as unknown as Record<string, number>);
        if (!channels || typeof channels !== "object") continue;
        const sample: Telemetry = {
          rpm: numberOrNull(channels["0"]),
          speed: numberOrNull(channels["2"]),
          gear: numberOrNull(channels["3"]),
          throttle: numberOrNull(channels["4"]),
          brake: numberOrNull(channels["5"]),
          drs: numberOrNull(channels["45"]),
        };
        if (sample.speed == null && sample.rpm == null && sample.throttle == null) continue;
        this.telemetry[number] = sample;
        found = true;
        if (sample.speed != null) {
          const history = this.speedHistory[number] ?? [];
          history.push(sample.speed);
          this.speedHistory[number] = history.slice(-40);
        }
      }
    }
    if (found) this.telemetryFeed = true;
  }

  private buildSnapshot(): LiveSnapshot {
    return normalize({
      connection: this.connection,
      raw: this.raw,
      lapLog: this.lapLog,
      sectorLog: this.sectorLog,
      positions: this.positions,
      trail: this.trail,
      telemetry: this.telemetry,
      speedHistory: this.speedHistory,
      qualiBests: this.qualiBests,
      heartbeatAt: this.heartbeatAt,
      positionFeed: this.positionFeed,
      telemetryFeed: this.telemetryFeed,
      generatedAt: Date.now(),
    });
  }

  private scheduleEmit(urgent: boolean) {
    if (urgent) this.dirtyUrgent = true;
    const elapsed = Date.now() - this.lastEmit;
    if (this.dirtyUrgent || elapsed >= 250) {
      if (this.emitTimer) {
        clearTimeout(this.emitTimer);
        this.emitTimer = null;
      }
      this.flush();
      return;
    }
    if (!this.emitTimer) {
      this.emitTimer = setTimeout(() => this.flush(), 250 - elapsed);
    }
  }

  private flush() {
    if (this.emitTimer) {
      clearTimeout(this.emitTimer);
      this.emitTimer = null;
    }
    const urgent = this.dirtyUrgent;
    this.dirtyUrgent = false;
    this.lastEmit = Date.now();
    const snapshot = this.buildSnapshot();
    this.latest = snapshot;
    if (urgent || this.history.length === 0 || snapshot.generatedAt - this.lastHistory >= 1000) {
      this.history.push({ t: snapshot.generatedAt, snapshot });
      this.lastHistory = snapshot.generatedAt;
      const cutoff = Date.now() - HISTORY_MS;
      while (this.history.length > 2 && this.history[0].t < cutoff) this.history.shift();
    }
    this.fanout({ type: "snapshot", t: snapshot.generatedAt, snapshot });
  }

  private fanout(event: HubEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        console.log("[pitwall] listener failed");
      }
    }
  }

  private scheduleRetry(gen: number) {
    if (this.stopped || gen !== this.gen) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.attempt);
    this.attempt = Math.min(this.attempt + 1, 5);
    this.connection = "reconnecting";
    this.scheduleEmit(true);
    setTimeout(() => {
      if (gen === this.gen && !this.stopped) void this.connect();
    }, delay);
  }

  private checkWatchdog() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.lastMessageAt) return;
    if (Date.now() - this.lastMessageAt > 25_000) {
      console.log("[pitwall] heartbeat timeout");
      void this.connect();
    }
  }

  private clearSocket() {
    if (this.ping) {
      clearInterval(this.ping);
      this.ping = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const globalHub = globalThis as { __pitwallHub?: Hub };

export function getHub(): Hub {
  const existing = globalHub.__pitwallHub;
  if (existing && existing.version === 2) return existing;
  existing?.stop();
  const hub = new Hub();
  globalHub.__pitwallHub = hub;
  return hub;
}
