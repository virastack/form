# @virastack/mask

## 2.0.0

A rewrite of the engine, the hook and the presets. See [MIGRATION.md](MIGRATION.md).

### Breaking Changes

- **Signature**: `useViraMask(form, schema)`. Field names, `from` and `rules` are typed from the form.
- **Single source of truth**: the hook keeps no value state; React Hook Form holds the raw value. `rawValue` is removed.
- **Presets**: `phone` is E.164 (Turkish layout after `+90`), `{ preset: "phone", country: "TR" }` is `(555) 123 45 67`; `iban` works for every country, `{ preset: "iban", country: "TR" }` keeps `TR` in the value; `currency` formats `1,234.56` and `{ preset: "currency", country: "TR" }` gives `₺1.234,56` (Intl); `number` uses `en-US` unless `country: "TR"`; `date` stores ISO. `email`, `url`, `username`, `alpha`, `password`, `text`, `zipCode` are removed, `taxNumber` → `vkn`, `numeric` → `number`.
- **Errors** are keys (`tckn.invalid`), not messages.
- **Peers**: React Hook Form 7.55+, Node 20+.

### Features

- **Slot-based engine**: custom tokens, `\` escapes, `[optional]` parts, `{fixed}` parts kept in the value, pattern arrays and functions.
- **Linked fields (`from`)**: CVV follows the card, currency follows a select, end date can't be before start date.
- **Number and currency**: `min`/`max`, `scale`, `signed`, `Intl` separators and symbols, `toMinorUnits`.
- **Date**: `min`/`max` (`"today"`), `minAge`, auto-correct while typing (`4` → `04/`, month 13 rejected), formats `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD.MM.YYYY`, `MM/YY`, `MM/YYYY`.
- **`@virastack/mask/server`**: `parseMasked(schema, formData, standardSchema?)`, validators and `createMask` without `"use client"`.
- **`maskResolver`**: keeps mask errors with Zod/Valibot resolvers or any Standard Schema.
- **Validators**: `isValidIBAN` works for every country: the country code sets the length (TR → 26, DE → 22…), then mod-97.
- **`createMask`, `definePreset`**: the same pure mask in the hook, on the server and in tests.
- **`output: "masked"`**, **`onComplete`**, development warnings.

### Bug Fixes

- TRY currency kept kuruş as typed; `1.234,56` parsed to `1234.56`.
- `register` rules (`required`, `deps`, `setValueAs`, `disabled`, `onChange`) are passed through.
- `reset()` and `setValue()` update the input.
- Validators no longer depend on `TR` (IBAN) or scan the schema (CVV).
- `aria-describedby` no longer points at an element that doesn't exist.

### Quality

- CI on Linux, macOS and Windows with Node 20/22/24: typecheck, ESLint (`no-explicit-any`), unit tests, real-browser tests (Chromium), `attw`, `publint`, `size-limit`.
- ESM and CommonJS builds with `.d.mts` and `.d.cts` types.

## 1.1.1

### Documentation

- **README**: Removed the Bundlephobia badge (Shields.io often rate-limits the upstream API on npm).

## 1.1.0

### Breaking Changes

- **Currency default locale**: Preset and helper defaults are now **US/English** (`1,234.56` — thousand `,`, decimal `.`). Turkish (`1.234,56` / `₺`) is an options override.
- **Phone default mask**: Preset `phone` is now NANP-style `(999) 999-9999`. Turkey grouping `(999) 999 99 99` is a mask override on the `phone` preset.

### Bug Fixes

- **IME / dead-key lock**: Recover when `compositionstart` fires without `compositionend` (e.g. `^` on dead-key layouts). `onChange` trusts `nativeEvent.isComposing`, clears a stuck flag, and resets composition state on blur.
- **Raw value pollution on blur**: `rawValue` / form state no longer pick up masked DOM values (spaces, parentheses) after blur when using `register`. Canonical raw is kept in an internal ref and re-asserted on blur.
- **Mask raw literals**: Card/phone/etc. raw values are scrubbed with `allowedChars` so mask literals never remain in form state.
- **Dependent CVV length**: When card type changes from Amex (4-digit CVV) to a non-Amex card, CVV `rawValue` and form state truncate to 3 digits (not only the display value).
- **Mixed custom masks**: Masks that combine letter and digit slots (e.g. `aaa-999`) no longer strip letters via a digits-only allowlist.

### Improvements

- **`rawValuesRef` source of truth**: Display formatting and sibling `resolveMask` lookups prefer canonical raw over possibly masked form/DOM values.
- **`syncDependentRaws`**: After a field updates, sibling fields with `resolveMask` (e.g. CVV) are re-processed immediately.

## 1.0.0

### Initial Release

- **@virastack/mask**: A lightweight, zero-dependency masking library for React Hook Form is now live!
- **Architecture**: Custom masking engine built for performance and reliability.
- **Hook**: `useViraMask` provides a simple, type-safe API for React Hook Form.
- **React Server Components**: Added `'use client'` directive for Next.js App Router and TanStack Start compatibility.

### Features

- **Full Type Support**: Enhanced TypeScript definitions for better developer experience.
- **Validation**: Built-in algorithmic validation for Credit Cards (Luhn) and Turkish Identity Number (TCKN).
- **Enhanced Card Validation**: Strict length checks based on card type (15 digits for Amex, 16 digits for others).
- **Card Type Detection**: Added `onCardTypeChange` callback to detect card issuer (Visa, Mastercard, Amex, Troy).
- **Dynamic CVV**: CVV field automatically adjusts length (3 or 4 digits) based on the entered card number.
- **Dynamic Masking**: Support for Amex cards (auto-switches to 4-6-5 format).
- **Presets**: Includes `card`, `expiry`, `cvv`, `tckn`, `phone`, `email`, `url`, `username`, `iban`, `taxNumber`, `zipCode`, `date`, `numeric`, and `currency`.
- **Currency Formatting**: Advanced currency handling with precision, decimal/thousand separators, and prefix/suffix symbol support.
- **Alpha Formatting**: Built-in support for alphabetical inputs with space handling.
- **UX Improvements**: 
  - Enhanced cursor stability during typing.
  - Improved backspace handling for currency fields with suffixes.
  - Prevented validation errors from triggering immediately while typing.
- **Customization**: Options for `allowedChars`, `forbiddenChars`, `transform`, and detailed currency configuration.
