const seen = new Set<string>();

/** Bundlers replace `process.env.NODE_ENV`; without one, warnings stay off. */
export const isDev: boolean = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
})();

/** Logs a development-only warning once per message. */
export function warn(message: string): void {
  if (!isDev || seen.has(message)) return;
  seen.add(message);
  console.warn(`[@virastack/mask] ${message}`);
}
