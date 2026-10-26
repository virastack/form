// Talks to the real API. Not part of CI: PWNED_LIVE=1 pnpm vitest run --project unit test/pwned.live.test.ts
import { describe, expect, it } from "vitest";
import { checkPwned } from "../src/pwned";

describe.skipIf(!process.env.PWNED_LIVE)("checkPwned (live)", () => {
  it("finds a famous password", async () => {
    const result = await checkPwned("password");
    expect(result.status).toBe("pwned");
  });

  it("does not find a random one", async () => {
    const random = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(36)).join("");
    expect(await checkPwned(random)).toEqual({ status: "safe" });
  });
});
