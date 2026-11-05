# @virastack/password

## 1.2.0

The policy now follows NIST SP 800-63B-4 more closely. The API stays the same, but the same password can get a different result, so check your tests that pin a `level` or an issue.

### Added

- **`useViraPassword(form, schema)`**: the same hook bound to React Hook Form, with the same shape as `useViraMask(form, schema)`: one entry per field, `matchWith` and `forbidden` take field names, `name` maps a key to another path and `rules` adds more React Hook Form rules. Each result's `inputProps` already include `register()`. Values are read from the form, so `reset()` and `setValue()` work, and a field the user already left is re-checked when the field it depends on changes, so `value`, `deps` and `trigger` are no longer needed. `useViraPassword(options)` works as before. `react-hook-form` is an optional peer: the hook only uses its types and the form's own methods. The hook bundle grows from about 2.2 KB to 2.8 KB (min+brotli).
- **`mfa` preset**: 8–64 characters without composition rules, for a password used with a second factor (NIST SP 800-63B-4).
- **`normalization` policy option**: `"NFKC"` (default, as before) or `"NFC"`, which NIST recommends. `normalizePassword(password, form)` and the hook's `normalization` option follow it. Changing it changes the normalized password you hash.
- **`validatePassword(..., { pwned })`**: also looks the password up in Have I Been Pwned when it passes the policy, and returns a Promise. A breached password gets `password.pwned` and score 0; a failed lookup never blocks (`pwned.status` is `unknown`).

### Changed

- **Whole-password comparison**: `forbidden` values and the `blocklist` are compared with the whole password after removing digits, symbols, leetspeak and repetition, as NIST asks, instead of being searched inside it. "ali1990" still fails for "Ali Can"; "kalitelibirsabahkahvesi" no longer does, and neither does "my-acme-account" with `blocklist: ["acme"]`.
- **Score by length, not character classes**: valid passwords are `fair` at the minimum, `good` from 5 characters more and `strong` from 10 more. An uppercase letter, a digit or a symbol no longer raises the level, which nudged users towards composition rules. Repeated characters still add little.
- **Repetition**: runs of one character such as "aaaabbbbccccdddd" are rejected as `password.repetitive`.

### Deprecated

- **`legacy` preset**: composition rules go against NIST SP 800-63B-4. It still works; use `require` if you must keep them.

## 1.1.1

### Changed

- **Monorepo**: `@virastack/password` now lives in [virastack/form](https://github.com/virastack/form) under `packages/password`. `repository.directory`, the issue link and the README links point there, and the README images, which pointed at the old repository, show again in the new brand colour. No code changes.

## 1.1.0

### Added

- **Entries**: `@virastack/password/strength` (`definePolicy`, `evaluate`, `normalizePassword`), `@virastack/password/server` (`validatePassword`) and `@virastack/password/pwned` (`checkPwned`). None of them has `"use client"`.
- **Strength**: `nist` (15–64 characters, no composition rules) and `legacy` presets, common password list, repetition and keyboard sequence checks, a policy `blocklist`, and `forbidden` values (email, name). NFKC and code point length. Error keys instead of messages.
- **Hook**: `policy`, `forbidden`, `value`, `matchWith`, `visible`, `onVisibleChange`, `hideOnSubmit`, `hideOnBlur` and `autoComplete` options; `strength`, `strengthProps`, `matches`, `issues`, `rule` and `capsLock` in the result.
- **Hide on submit**: the password is hidden when its form is submitted or reset, so password managers see a password field. Turn off with `hideOnSubmit: false`.
- **Focus**: a mouse or touch press on the toggle returns focus and the caret to the input; a keyboard press keeps focus on the button.
- **`composeRefs`** helper.
- **Leaked passwords**: Have I Been Pwned range API with k-anonymity and padding; never throws.

### Changed

- The input gets `autoComplete="current-password"` (`new-password` with `policy` or `matchWith`), `spellCheck={false}`, `autoCorrect="off"` and `autoCapitalize="off"` by default. Override them through `inputProps`, or pass `autoComplete: false`.
- `mergeProps` composes `ref`s and joins `aria-describedby`; it accepts two different prop types.
- `inputProps` still holds attributes only (no ref, no handlers), so it can be spread before or after `register()` or a ViraStack Mask field. Caps Lock, blur and typing are read with native listeners.
- `inputProps.id` now also drives `aria-controls`; in 1.0 the button pointed at the hook's id even when `inputProps.id` replaced it.
- `getInputAriaAttributes` returns a typed object instead of `Record<string, any>`.
- Package: `.mjs`/`.cjs` with `.d.mts`/`.d.cts` types (checked with attw and publint). Deep imports into `dist` were never part of the API and the file names changed.

### Quality

- No `any`; ESLint `no-explicit-any`, type tests.
- Unit, property-based, browser (Chromium, Firefox, WebKit) and Next.js tests; CI on 3 OSes × Node 20/22/24 and React 18.
- Size budgets with size-limit.


## 1.0.2

### Documentation

- **README**: Removed the Bundlephobia badge (Shields.io often rate-limits the upstream API on npm).

## 1.0.1

### Documentation

- **README logos**: Fixed broken npm README images. Light/dark logo assets now load from `assets/logo-light.png` and `assets/logo-dark.png` via raw GitHub URLs.

## 1.0.0

### Initial Release

- **@virastack/password**: A fully accessible and customizable password visibility hook for React is now live!
- **Architecture**: Logic is separated from React state, making it adaptable and clean.
- **Hook**: `useViraPassword` provides a simple, robust "React-First" solution.
- **React Server Components**: Added `'use client'` directive for Next.js App Router and TanStack Start compatibility.

### Features

- **Full Type Support**: Enhanced TypeScript definitions for better developer experience.
- **Accessibility First**: Fully ARIA compliant out of the box for better screen reader support.
- **Smart Defaults**: Includes minimal SVG icons by default, so you can start using it immediately.
- **Customizable**: Use your own icons or UI components to match your design system.
- **Prop Merging**: Safely merges user props with hook-generated props to prevent overrides.
- **State Sync**: Automatically handles `disabled` and `readOnly` states for a consistent UX.
