export type SectorTone = "purple" | "green" | "yellow" | "white" | "none";

export type FlagTone = "green" | "yellow" | "sc" | "vsc" | "red" | "chequered" | "neutral";

export type ConnectionState = "connecting" | "live" | "reconnecting";

export type Stint = {
  compound: string;
  laps: number | null;
  fresh: boolean;
};

export type LapRecord = {
  lap: number;
  time: string;
  tone: SectorTone;
};

export type SectorRecord = {
  s1: string;
  s2: string;
  s3: string;
};

export type DriverRow = {
  number: string;
  code: string;
  first: string;
  last: string;
  broadcast: string;
  team: string;
  colour: string;
  position: number | null;
  showPosition: boolean;
  gap: string;
  interval: string;
  catching: boolean;
  lastLap: string;
  lastTone: SectorTone;
  bestLap: string;
  bestLapNum: number | null;
  sectors: { time: string; tone: SectorTone; live: boolean }[];
  compound: string;
  compoundLetter: string;
  tyreAge: number | null;
  freshTyre: boolean;
  stops: number;
  inPit: boolean;
  pitOut: boolean;
  stopped: boolean;
  retired: boolean;
  knockedOut: boolean;
  laps: number | null;
  grid: string | null;
  speeds: { i1: string; i2: string; fl: string; st: string };
  bestSpeeds: { i1: string; i2: string; fl: string; st: string };
  bestSectors: { time: string; position: number | null }[];
  stints: Stint[];
  q1: string;
  q2: string;
  q3: string;
  lapsDone: LapRecord[];
  sectorTrend: SectorRecord[];
};

export type WeatherView = {
  air: string | null;
  track: string | null;
  humidity: string | null;
  windSpeed: string | null;
  windDir: string | null;
  rain: string | null;
  pressure: string | null;
};

export type LiveSnapshot = {
  generatedAt: number;
  connection: ConnectionState;
  session: {
    name: string;
    type: string;
    meeting: string;
    officialName: string;
    circuit: string;
    location: string;
    country: string;
    path: string;
    status: string;
    gmtOffset: string;
  } | null;
  track: { status: string; message: string; label: string; tone: FlagTone };
  lap: { current: number | null; total: number | null };
  clock: { remaining: string; remainingSec: number | null; extrapolating: boolean; utc: string | null };
  heartbeatAt: number | null;
  weather: WeatherView;
  drivers: DriverRow[];
  positions: Record<string, { x: number; y: number }>;
  trail: { x: number; y: number }[];
  telemetry: Record<
    string,
    {
      speed: number | null;
      throttle: number | null;
      brake: number | null;
      gear: number | null;
      rpm: number | null;
      drs: number | null;
    }
  >;
  speedHistory: Record<string, number[]>;
  qualiMode: boolean;
  positionFeed: boolean;
  telemetryFeed: boolean;
};

export type RcMessage = {
  id: string;
  t: number;
  utc: string;
  lap: number | null;
  category: string;
  flag: string | null;
  message: string;
  sector: number | null;
  scope: string | null;
};

export type RadioCapture = {
  id: string;
  t: number;
  utc: string;
  number: string;
  path: string;
};

export type TimedSnapshot = { t: number; snapshot: LiveSnapshot };

export type LiveStatus = {
  connection: ConnectionState;
  meeting: string | null;
  sessionName: string | null;
  circuit: string | null;
  location: string | null;
  country: string | null;
  sessionStatus: string | null;
  trackLabel: string | null;
  trackTone: FlagTone;
  lap: number | null;
  totalLaps: number | null;
  clock: string | null;
  heartbeatAt: number | null;
  updatedAt: number | null;
  top3: { code: string; team: string; colour: string; gap: string; position: number | null }[];
  active: boolean;
};
