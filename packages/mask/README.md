<div align="center">

<a href="https://github.com/virastack/form/tree/main/packages/mask" target="_blank" rel="noreferrer">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/virastack/form/main/packages/mask/assets/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/virastack/form/main/packages/mask/assets/logo-light.png">
    <img src="https://raw.githubusercontent.com/virastack/form/main/packages/mask/assets/logo-light.png" alt="ViraStack Mask" height="120" style="max-width: 100%;" />
  </picture>
</a>

*Zero-dependency input masks for React Hook Form, with Turkish presets (TCKN, VKN, IBAN) and server validation*

[![ViraStack Mask](https://img.shields.io/badge/ViraStack-Mask-%23605efe)](https://virastack.com/mask/)
[![npm version](https://img.shields.io/npm/v/@virastack/mask?color=605efe)](https://www.npmjs.com/package/@virastack/mask)
[![npm downloads](https://img.shields.io/npm/dt/@virastack/mask?color=605efe)](https://www.npmjs.com/package/@virastack/mask)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/virastack/form/blob/main/LICENSE)
[![@virastack](https://img.shields.io/badge/-%40virastack-black?logo=x&logoColor=white)](https://x.com/virastack)

</div>

---

### [Read the full documentation →](https://virastack.com/mask/)

## Features

- **Built for React Hook Form:** The form keeps the raw value (`5551234567`); the input shows the mask. `register` rules, `reset`, `setValue`, `watch`, `Controller` and resolvers keep working.
- **Type-safe:** Field names, `from` links and rules are checked against your form type. No `any`.
- **Turkey ready:** TCKN, VKN, Turkish IBAN and phone, TRY with kuruş, and the bank behind an IBAN.
- **Server support:** `@virastack/mask/server` parses and validates the same schema in Server Actions.
- **Zero dependencies:** under 10 KB min+brotli for everything; less once tree-shaken.

## Quick Start

```bash
npm install @virastack/mask
```

```tsx
import { useForm } from "react-hook-form";
import { useViraMask } from "@virastack/mask";

export function Checkout() {
  const form = useForm<{ phone: string; card: string; cvv: string }>();

  const { phone, card, cvv } = useViraMask(form, {
    phone: { preset: "phone", country: "TR" },
    card: "card",
    cvv: { preset: "cvv", from: "card" },
  });

  return (
    <form onSubmit={form.handleSubmit(console.log)}>
      <input {...phone} placeholder="(555) 123 45 67" />
      <input {...card} />
      <input {...cvv} />
    </form>
  );
}
```

`form.watch("phone")` returns `5551234567`, not `(555) 123 45 67`. Use `output: "masked"` if your backend wants the masked text.

## Presets

| Preset | Shows | Form value |
| :--- | :--- | :--- |
| `phone` | `+90 (555) 123 45 67`, other countries as `+4915112345678` | `+905551234567` |
| `phone` + `country: "TR"` | `(555) 123 45 67` | `5551234567` |
| `iban` | `GB82 WEST 1234 5698 7654 32` (any country, mod-97) | `GB82WEST12345698765432` |
| `iban` + `country: "TR"` | `TR33 0006 1005 1978 6457 8413 26` | `TR330006100519786457841326` |
| `card` | `4111 1111 1111 1111`, Amex `3782 822463 10005` (Luhn) | `4111111111111111` |
| `cvv` | 3 digits, 4 for Amex (with `from: "card"`) | `123` |
| `expiry` | `12/28`, past months are invalid | `1228` |
| `tckn`, `vkn` | `10000000146` | `10000000146` |
| `currency` | `1,234.56`; with a code `$1,234.56` (Intl) | `1234.56` |
| `currency` + `country: "TR"` | `₺1.234,56` | `1234.56` |
| `number` | `1,234` | `1234` |
| `number` + `country: "TR"` | `1.234` | `1234` |
| `date` | `01/02/2026` | `2026-02-01` |

## Schema options

```tsx
useViraMask(form, {
  // Turkish layout: phone, iban, currency and number take country: "TR"
  iban: { preset: "iban", country: "TR" },
  // a preset with overrides
  birthDate: { preset: "date", date: { max: "today", minAge: 18 } },
  // React Hook Form rules pass through
  tckn: { preset: "tckn", rules: { required: "tckn.required" } },
  // another form field drives the mask
  price: { preset: "currency", from: "currencyCode" },
  endDate: { preset: "date", from: "startDate" },
  // nested field
  zip: { name: "address.zip", mask: "99999" },
  // custom pattern: 9 digit, a letter, * letter or digit, [optional], {kept in value}, \ escape
  plate: { mask: "99 a[aa] 99[99]", transform: "uppercase" },
  // fires when the mask is full
  card: { preset: "card", onComplete: () => form.setFocus("expiry") },
});
```

Errors are keys such as `tckn.invalid`, `phone.incomplete` or `date.min`. Map them to messages in your own i18n layer.

## Resolvers (Zod, Valibot)

React Hook Form skips `register` validation when a resolver is set. Wrap it so mask errors still show up:

```tsx
import { maskResolver } from "@virastack/mask";

useForm({ resolver: maskResolver(masks, zodResolver(schema)) });
// or pass any Standard Schema directly
useForm({ resolver: maskResolver(masks, schema) });
```

## Server

```ts
"use server";
import { parseMasked } from "@virastack/mask/server";

export async function checkout(formData: FormData) {
  const result = await parseMasked(masks, formData, schema); // schema is optional
  if (!result.success) return { errors: result.errors };
  // result.data has raw values: { phone: "5551234567", ... }
}
```

The root import has `"use client"`. In Server Components and Actions, import from `@virastack/mask/server`.

## Core

```ts
import { createMask, definePreset, toMinorUnits } from "@virastack/mask/server";

const plate = definePreset("plate", { mask: "99 a[aa] 99[99]", transform: "uppercase" });
createMask(plate).format("34abc123"); // "34 ABC 123"
createMask({ preset: "currency", country: "TR" }).format("1234.5"); // "₺1.234,5"
toMinorUnits("1234.56", "TRY"); // 123456
```

### Bank from a Turkish IBAN

```ts
import { getTurkishBank, turkishBanks } from "@virastack/mask";

getTurkishBank("TR63 0006 2000 0000 0000 1234 56"); // { code: "0062", name: "T. GARANTİ BANKASI A.Ş." }
getTurkishBank("TR63 0006 2"); // works as soon as the bank digits are typed
turkishBanks.length; // 70, from the TCMB payment systems participants list
```

The bank is read from the IBAN's bank code, so there is no API call. It does not
check the IBAN itself; the `iban` preset and `isValidIBAN` do. See the
[live demo and full list](https://virastack.com/mask/docs/banks).

Upgrading from v1? See [MIGRATION.md](MIGRATION.md).

## Ecosystem

Part of the [ViraStack](https://virastack.com) ecosystem: [Academy](https://github.com/virastack/academy) · [Start](https://github.com/virastack/start) · [AI](https://github.com/virastack/ai) · [Password](https://github.com/virastack/form/tree/main/packages/password) · [Address](https://github.com/virastack/form/tree/main/packages/address) · [Guide](https://github.com/virastack/guide)

## License

[MIT](LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
