# @virastack/password

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
