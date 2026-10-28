export type PwnedUnknownReason = "empty" | "unsupported" | "network" | "timeout" | "aborted" | "rate-limited" | "http";

export type PwnedResult =
  | { status: "pwned"; count: number }
  | { status: "safe" }
  | { status: "unknown"; reason: PwnedUnknownReason };

export interface CheckPwnedOptions {
  signal?: AbortSignal;
  /** Milliseconds before giving up with `unknown`. @default 5000 */
  timeout?: number;
  /** A custom `fetch`, e.g. for tests or a proxy. @default globalThis.fetch */
  fetch?: typeof globalThis.fetch;
  /** @default "https://api.pwnedpasswords.com/range/" */
  endpoint?: string;
}

const ENDPOINT = "https://api.pwnedpasswords.com/range/";

const sha1Hex = async (password: string): Promise<string | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const digest = await subtle.digest("SHA-1", new TextEncoder().encode(password));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  } catch {
    return null;
  }
};

/**
 * Looks the password up in Have I Been Pwned's Pwned Passwords (range API, k-anonymity):
 * only the first 5 characters of its SHA-1 hash leave the machine.
 * Never throws and never blocks: on any failure the status is `unknown`.
 * Call it from the server; from a browser the user's IP is visible to HIBP.
 */
export const checkPwned = async (password: string, options: CheckPwnedOptions = {}): Promise<PwnedResult> => {
  const unknown = (reason: PwnedUnknownReason): PwnedResult => ({ status: "unknown", reason });
  if (typeof password !== "string" || password === "") return unknown("empty");
  const request = options.fetch ?? globalThis.fetch;
  if (typeof request !== "function") return unknown("unsupported");
  if (options.signal?.aborted) return unknown("aborted");

  const hash = await sha1Hex(password);
  if (!hash) return unknown("unsupported");
  if (options.signal?.aborted) return unknown("aborted");
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeout ?? 5000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await request(`${options.endpoint ?? ENDPOINT}${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    if (response.status === 429) return unknown("rate-limited");
    if (!response.ok) return unknown("http");
    const body = await response.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate?.toUpperCase() !== suffix) continue;
      const times = Number.parseInt(count ?? "", 10);
      // Padding entries have a count of 0.
      return times > 0 ? { status: "pwned", count: times } : { status: "safe" };
    }
    return { status: "safe" };
  } catch {
    if (timedOut) return unknown("timeout");
    if (options.signal?.aborted) return unknown("aborted");
    return unknown("network");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
};
