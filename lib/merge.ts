function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
}

export function deepMerge(target: unknown, source: unknown): unknown {
  if (source === undefined) return target;
  if (source === null) return null;
  if (Array.isArray(source)) {
    const base = Array.isArray(target) ? target.slice() : [];
    source.forEach((item, index) => {
      base[index] = deepMerge(base[index], item);
    });
    return base;
  }
  if (!isPlainObject(source)) return source;

  if (numericKeys(source) && Array.isArray(target)) {
    const base = target.slice();
    for (const key of Object.keys(source)) {
      const index = Number(key);
      base[index] = deepMerge(base[index], source[key]);
    }
    return base;
  }

  const base: Record<string, unknown> = isPlainObject(target) ? { ...target } : {};
  for (const key of Object.keys(source)) {
    if (key === "_kf") continue;
    base[key] = deepMerge(base[key], source[key]);
  }
  return base;
}
