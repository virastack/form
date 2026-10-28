import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPwned } from "../src/pwned";

// SHA-1("password") = 5BAA6 1E4C9B93F3F0682250B6CF8331B7EE68FD8
const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
const sha1 = (text: string) => createHash("sha1").update(text, "utf8").digest("hex").toUpperCase();

const respond = (body: string, init: ResponseInit = {}) => vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, init));
// A fetch that only settles when aborted, like a hung connection.
const hanging = () =>
  vi.fn(
    (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );

// Fake only the timers, then let the hashing (real async) finish until fetch is called.
const fakeTimersAfterFetch = async (fetch: ReturnType<typeof hanging>) => {
  while (fetch.mock.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("checkPwned", () => {
  it("sends only the 5-character prefix, with padding", async () => {
    const fetch = respond(`${SUFFIX}:10\r\n`);
    await checkPwned("password", { fetch });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect(new Headers(init?.headers).get("Add-Padding")).toBe("true");
    expect(init?.body).toBeUndefined();

    const secret = "Zq-unique-secret-91";
    const spy = respond("");
    await checkPwned(secret, { fetch: spy });
    const sent = JSON.stringify(spy.mock.calls);
    expect(sent).not.toContain(secret);
    expect(sent).not.toContain(sha1(secret).slice(5));
    expect(sent).toContain(sha1(secret).slice(0, 5));
  });

  it("finds a pwned password and its count", async () => {
    const body = ["0018A45C4D1DEF81644B54AB7F969B88D65:1", `${SUFFIX}:10434004`, "00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2"].join("\r\n");
    expect(await checkPwned("password", { fetch: respond(body) })).toEqual({ status: "pwned", count: 10434004 });
  });

  it("matches the suffix case-insensitively", async () => {
    expect(await checkPwned("password", { fetch: respond(`${SUFFIX.toLowerCase()}:3`) })).toEqual({ status: "pwned", count: 3 });
  });

  it("is safe when the suffix is missing", async () => {
    expect(await checkPwned("password", { fetch: respond("0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n") })).toEqual({ status: "safe" });
    expect(await checkPwned("password", { fetch: respond("") })).toEqual({ status: "safe" });
  });

  it("ignores padding entries with a count of 0", async () => {
    expect(await checkPwned("password", { fetch: respond(`${SUFFIX}:0`) })).toEqual({ status: "safe" });
    expect(await checkPwned("password", { fetch: respond(`${SUFFIX}:`) })).toEqual({ status: "safe" });
  });

  it("hashes UTF-8 without normalizing", async () => {
    for (const text of ["şifre", "パスワード", "🔒🔑", "é"]) {
      const fetch = respond("");
      await checkPwned(text, { fetch });
      expect(fetch.mock.calls[0][0]).toBe(`https://api.pwnedpasswords.com/range/${sha1(text).slice(0, 5)}`);
    }
  });

  it("uses a custom endpoint and the global fetch", async () => {
    const fetch = respond("");
    vi.stubGlobal("fetch", fetch);
    await checkPwned("password", { endpoint: "https://proxy.example/range/" });
    expect(fetch.mock.calls[0][0]).toBe("https://proxy.example/range/5BAA6");
  });

  it.each([
    [429, "rate-limited"],
    [500, "http"],
    [503, "http"],
    [404, "http"],
  ] as const)("HTTP %i → unknown (%s)", async (status, reason) => {
    expect(await checkPwned("password", { fetch: respond("", { status }) })).toEqual({ status: "unknown", reason });
  });

  it("network errors → unknown", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await checkPwned("password", { fetch })).toEqual({ status: "unknown", reason: "network" });
  });

  it("a broken body → unknown", async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: () => Promise.reject(new Error("reset")) }) as unknown as Response);
    expect(await checkPwned("password", { fetch })).toEqual({ status: "unknown", reason: "network" });
  });

  it("times out", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetch = hanging();
    const pending = checkPwned("password", { fetch, timeout: 100 });
    await fakeTimersAfterFetch(fetch);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ status: "unknown", reason: "timeout" });
  });

  it("defaults to a 5 second timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let settled = false;
    const fetch = hanging();
    const pending = checkPwned("password", { fetch }).then((r) => ((settled = true), r));
    await fakeTimersAfterFetch(fetch);
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ status: "unknown", reason: "timeout" });
  });

  it("honours an AbortSignal during the request", async () => {
    const controller = new AbortController();
    const fetch = hanging();
    const pending = checkPwned("password", { fetch, signal: controller.signal });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    controller.abort();
    expect(await pending).toEqual({ status: "unknown", reason: "aborted" });
  });

  it("does not call fetch with an already aborted signal", async () => {
    const fetch = respond("");
    expect(await checkPwned("password", { fetch, signal: AbortSignal.abort() })).toEqual({ status: "unknown", reason: "aborted" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops if aborted while hashing", async () => {
    const controller = new AbortController();
    const fetch = respond("");
    const pending = checkPwned("password", { fetch, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ status: "unknown", reason: "aborted" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes its abort listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await checkPwned("password", { fetch: respond(""), signal: controller.signal });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("without crypto.subtle (plain HTTP) → unknown", async () => {
    vi.stubGlobal("crypto", {});
    const fetch = respond("");
    expect(await checkPwned("password", { fetch })).toEqual({ status: "unknown", reason: "unsupported" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("without crypto at all → unknown", async () => {
    vi.stubGlobal("crypto", undefined);
    expect(await checkPwned("password", { fetch: respond("") })).toEqual({ status: "unknown", reason: "unsupported" });
  });

  it("when digest fails → unknown", async () => {
    vi.stubGlobal("crypto", { subtle: { digest: () => Promise.reject(new Error("nope")) } });
    expect(await checkPwned("password", { fetch: respond("") })).toEqual({ status: "unknown", reason: "unsupported" });
  });

  it("without fetch → unknown", async () => {
    vi.stubGlobal("fetch", undefined);
    expect(await checkPwned("password")).toEqual({ status: "unknown", reason: "unsupported" });
  });

  it("empty or non-string passwords are not looked up", async () => {
    const fetch = respond("");
    expect(await checkPwned("", { fetch })).toEqual({ status: "unknown", reason: "empty" });
    expect(await checkPwned(null as unknown as string, { fetch })).toEqual({ status: "unknown", reason: "empty" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
