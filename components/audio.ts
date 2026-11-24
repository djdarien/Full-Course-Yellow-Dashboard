export type AlertKind =
  | "yellow"
  | "sc"
  | "vsc"
  | "red"
  | "green"
  | "chequered"
  | "raceControl"
  | "gain"
  | "loss"
  | "personalBest";

type Osc = OscillatorType;

let context: AudioContext | null = null;

export async function armAudio(): Promise<void> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("Web Audio is unavailable");
  context = context ?? new Ctx();
  await context.resume();
}

function blip(freq: number, when: number, duration: number, type: Osc, peak: number, slide?: number) {
  if (!context) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), when + duration);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), when + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

export function playAlert(kind: AlertKind, volume: number) {
  if (!context || context.state !== "running") return;
  const now = context.currentTime + 0.01;
  const level = Math.max(0, Math.min(1, volume)) * 0.12;
  if (level <= 0.001) return;
  if (kind === "yellow") {
    blip(740, now, 0.09, "square", level);
    blip(740, now + 0.16, 0.09, "square", level);
  } else if (kind === "sc") {
    blip(196, now, 0.14, "sawtooth", level);
    blip(164, now + 0.18, 0.14, "sawtooth", level);
    blip(196, now + 0.36, 0.16, "sawtooth", level * 0.9);
  } else if (kind === "vsc") {
    blip(415, now, 0.1, "triangle", level);
    blip(330, now + 0.14, 0.12, "triangle", level);
  } else if (kind === "red") {
    blip(140, now, 0.32, "square", level * 1.1);
  } else if (kind === "green") {
    blip(523, now, 0.18, "sine", level, 784);
  } else if (kind === "chequered") {
    blip(880, now, 0.08, "square", level * 0.7);
    blip(659, now + 0.1, 0.08, "square", level * 0.7);
    blip(880, now + 0.2, 0.12, "square", level * 0.8);
  } else if (kind === "raceControl") {
    blip(1320, now, 0.045, "sine", level * 0.45);
  } else if (kind === "gain") {
    blip(660, now, 0.07, "sine", level);
    blip(880, now + 0.08, 0.1, "sine", level);
  } else if (kind === "loss") {
    blip(494, now, 0.08, "sine", level);
    blip(330, now + 0.09, 0.12, "sine", level);
  } else if (kind === "personalBest") {
    blip(988, now, 0.07, "sine", level);
    blip(1318, now + 0.08, 0.12, "sine", level);
  }
}
