const FALLBACKS: { test: RegExp; hex: string }[] = [
  { test: /mercedes/i, hex: "27F4D2" },
  { test: /red bull/i, hex: "3671C6" },
  { test: /ferrari/i, hex: "E8002D" },
  { test: /mclaren/i, hex: "FF8000" },
  { test: /audi/i, hex: "BB0A30" },
  { test: /cadillac/i, hex: "C6A664" },
  { test: /alpine/i, hex: "FF87BC" },
  { test: /haas/i, hex: "B6BABD" },
  { test: /aston/i, hex: "229971" },
  { test: /williams/i, hex: "64C4FF" },
  { test: /racing bulls|^rb$|rb f1|visa cash/i, hex: "6692FF" },
];

export function teamColour(teamName: string | undefined, feedHex: string | undefined): string {
  const raw = (feedHex || "").replace("#", "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(raw) && raw.toLowerCase() !== "000000") {
    return `#${raw}`;
  }
  const name = teamName || "";
  const match = FALLBACKS.find((item) => item.test.test(name));
  return match ? `#${match.hex}` : "#8d8a84";
}

export function constructorColour(name: string): string {
  return teamColour(name, undefined);
}
