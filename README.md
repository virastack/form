<div align="center">

<a href="https://github.com/virastack/password" target="_blank" rel="noreferrer">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/virastack/password/main/assets/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/virastack/password/main/assets/logo-light.png">
    <img src="https://raw.githubusercontent.com/virastack/password/main/assets/logo-light.png" alt="ViraStack Password" height="120" style="max-width: 100%;" />
  </picture>
</a>

*Accessible password hook for React: visibility, strength, confirmation and server checks*

[![ViraStack Password](https://img.shields.io/badge/ViraStack-Password-%23ff2056)](https://virastack.com/password/)
[![npm version](https://img.shields.io/npm/v/@virastack/password)](https://www.npmjs.com/package/@virastack/password)
[![npm downloads](https://img.shields.io/npm/dt/@virastack/password)](https://www.npmjs.com/package/@virastack/password)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/virastack/password/blob/main/LICENSE)
[![@virastack](https://img.shields.io/badge/-%40virastack-black?logo=x&logoColor=white)](https://x.com/virastack)

</div>

---

### [Read the full documentation →](https://virastack.com/password/)

## Features

- **Headless:** Props for your `<input>` and `<button>`; the bar, colours and text stay yours.
- **Radix parity:** Hides on submit for password managers, focus returns to the input after a click, controlled `visible`, Caps Lock, `autoComplete`.
- **Strength, NIST style:** `@virastack/password/strength` checks length (15–64), common passwords, repetition and personal info. No composition rules by default.
- **Same rules on the server:** `@virastack/password/server` runs the same policy in Server Actions.
- **Leaked password check:** `@virastack/password/pwned` asks Have I Been Pwned with k-anonymity. Optional.
- **Error keys, not messages:** `password.tooShort`, `password.mismatch`… Map them in your own i18n.
- **Zero dependencies:** ~2 KB min+brotli for the hook; the strength engine only ships when you pass a policy.

## Quick Start

```bash
npm install @virastack/password
```

```tsx
import { useViraPassword } from "@virastack/password";

function PasswordField() {
  const { inputProps, btnProps } = useViraPassword();

  return (
    <div>
      <input {...inputProps} placeholder="Enter password" />
      <button {...btnProps} />
    </div>
  );
}
```

## Sign-up form (React Hook Form)

```tsx
// lib/password-policy.ts – shared by the form and the server, no "use client"
import { definePolicy } from "@virastack/password/strength";
export const policy = definePolicy(); // NIST: 15–64 characters
```

```tsx
import { mergeProps, useViraPassword } from "@virastack/password";
import { useForm } from "react-hook-form";
import { policy } from "@/lib/password-policy";

function Signup() {
  const form = useForm({ defaultValues: { email: "", password: "", confirm: "" } });
  const password = form.watch("password");

  const pw = useViraPassword({ policy, value: password, forbidden: [form.watch("email")] });
  const confirm = useViraPassword({ matchWith: password, value: form.watch("confirm") });

  return (
    <form onSubmit={form.handleSubmit(console.log)}>
      <input type="email" autoComplete="username" {...form.register("email")} />

      {/* deps re-checks the confirm field when the password changes */}
      <input {...mergeProps(pw.inputProps, form.register("password", { ...pw.rule, deps: ["confirm"] }))} />
      <button {...pw.btnProps} />
      <p {...pw.strengthProps}>{pw.strength?.level}</p>
      {pw.capsLock && <p>Caps Lock is on</p>}

      <input {...mergeProps(confirm.inputProps, form.register("confirm", confirm.rule))} />
      <button {...confirm.btnProps} />
    </form>
  );
}
```

- Pass `value` from `watch()`: `reset()` and `setValue()` don't fire input events.
- Use `mergeProps` (or `inputProps: register(...)`) instead of spreading `register()` after `inputProps`, so both sets of handlers run.
- `deps` only runs on user input. After `setValue("password", …)`, call `trigger("confirm")`.

## Options

| Option | Description |
| :--- | :--- |
| `defaultVisible`, `visible`, `onVisibleChange` | Uncontrolled or controlled visibility |
| `hideOnSubmit` | Hide on form submit and reset (default `true`) |
| `hideOnBlur` | Hide when focus leaves the field or the tab is hidden (default `false`) |
| `autoComplete` | Default `current-password`; `new-password` with `policy` or `matchWith`; `false` leaves it out |
| `policy`, `forbidden` | Strength policy and values the password must not contain |
| `matchWith` | The password a confirm field must repeat |
| `value` | Current value, e.g. `watch("password")` |
| `disabled`, `readOnly` | Disable the toggle and mirror the state on the input |
| `icons` | `{ show, hide }` custom icons |
| `id`, `inputProps`, `btnProps` | Props merged into the generated ones |

Returns `{ inputProps, btnProps, isVisible, toggle, setVisible, capsLock, strength, strengthProps, matches, issues, rule }`.

## Strength

```ts
import { definePolicy, evaluate } from "@virastack/password/strength";

const policy = definePolicy({ preset: "nist", blocklist: ["acme"] });
evaluate("correct horse battery staple", policy, { forbidden: ["omer@example.com"] });
// { score: 0, level: "weak", valid: false, length: 28, checks: {...}, issues: ["password.common"] }
```

| Preset | Length | Composition |
| :--- | :--- | :--- |
| `nist` (default) | 15–64 | none, per NIST SP 800-63B-4 |
| `legacy` | 8–64 | lowercase, uppercase, digit and symbol |

Passwords are normalized with NFKC and counted in code points (emoji and Turkish letters count once); nothing is cut at the limit. `forbidden` splits emails (local part) and names into parts; parts shorter than `minTokenLength` (default 3) are ignored. Raise it if short names cause false positives.

Don't block pasting into password fields: password managers rely on it.

## Server

```ts
"use server";
import { validatePassword } from "@virastack/password/server";
import { policy } from "@/lib/password-policy";

export async function signup(formData: FormData) {
  const result = validatePassword(formData.get("password"), policy, {
    forbidden: [formData.get("email")],
    confirm: formData.get("confirm"),
  });
  if (!result.valid) return { errors: result.issues };
  // hash result.password (NFKC-normalized), then create the user
  return { ok: true };
}
```

The root import has `"use client"`. In Server Components and Actions, import from `/server` or `/strength`.

## Leaked passwords

```ts
import { checkPwned } from "@virastack/password/pwned";

const result = await checkPwned(password, { signal, timeout: 3000 });
// { status: "pwned", count: 10434004 } | { status: "safe" } | { status: "unknown", reason: "timeout" }
```

Only the first 5 characters of the SHA-1 hash are sent. On any failure the status is `unknown` and nothing is blocked. Call it from the server: from a browser, Have I Been Pwned sees the user's IP. `crypto.subtle` needs HTTPS or localhost.

## Ecosystem

Part of the [ViraStack](https://virastack.com) ecosystem: [Academy](https://github.com/virastack/academy) · [Start](https://github.com/virastack/start) · [AI](https://github.com/virastack/ai) · [Mask](https://github.com/virastack/mask) · [Guide](https://github.com/virastack/guide)

## License

[MIT](LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
