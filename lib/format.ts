export function parseClock(value: string | undefined | null): number | null {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export function formatRemaining(seconds: number | null, fallback = "—"): string {
  if (seconds == null || !Number.isFinite(seconds)) return fallback;
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatUtc(utc: string | null | undefined): string {
  if (!utc) return "—";
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return utc;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function heartbeatLabel(at: number | null, viewTime: number): string {
  if (!at) return "—";
  const seconds = Math.max(0, (viewTime - at) / 1000);
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function cardinal(degrees: string | null): string {
  if (!degrees) return "";
  const value = Number(degrees);
  if (Number.isNaN(value)) return "";
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round((((value % 360) + 360) % 360) / 45) % 8];
}

export function sessionInstant(date: string, time?: string): Date {
  const stamp = time ? `${date}T${time}` : `${date}T00:00:00Z`;
  return new Date(stamp.endsWith("Z") || stamp.includes("+") ? stamp : `${stamp}Z`);
}

export function formatSessionWhen(date: string, time?: string): string {
  const instant = sessionInstant(date, time);
  if (Number.isNaN(instant.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}
