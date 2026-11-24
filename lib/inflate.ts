import zlib from "zlib";

export function inflatePayload(payload: string): unknown {
  const raw = Buffer.from(payload, "base64");
  let inflated: Buffer;
  try {
    inflated = zlib.inflateSync(raw);
  } catch {
    try {
      inflated = zlib.inflateRawSync(raw);
    } catch {
      inflated = zlib.unzipSync(raw);
    }
  }
  return JSON.parse(inflated.toString("utf8"));
}
