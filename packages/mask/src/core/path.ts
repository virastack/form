const split = (path: string) => path.split(/[.[\]]/).filter(Boolean);

export function getPath(source: unknown, path: string): unknown {
  let current = source;
  for (const key of split(path)) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = split(path);
  let current: Record<string, unknown> = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
      return;
    }
    const next = current[key];
    if (next === null || typeof next !== "object") {
      current[key] = /^\d+$/.test(keys[index + 1]) ? [] : {};
    }
    current = current[key] as Record<string, unknown>;
  });
}
