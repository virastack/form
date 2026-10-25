# Migrating from v1 to v2

v2 is a rewrite. The hook signature, preset list and some values changed.

## Hook signature

```diff
- const { phone } = useViraMask({ form, schema: { phone: "phone" } });
+ const { phone } = useViraMask(form, { phone: { preset: "phone", country: "TR" } });
```

Schema keys must be field names of your form (or set `name`). Typos are type errors.

## `rawValue` is gone

The form already holds the raw value. Read it with `form.watch("phone")` or `form.getValues("phone")`.

## Presets

| v1 | v2 |
| :--- | :--- |
| `phone` (US `(999) 999-9999`) | `{ preset: "phone", country: "TR" }` for `(555) 123 45 67`, `"phone"` for E.164 (`+905551234567`). For a US layout: `{ mask: "(999) 999-9999" }` |
| `iban` (Turkey only, value without `TR`) | `{ preset: "iban", country: "TR" }` (value includes `TR`), `"iban"` for any country |
| `currency` (US separators, no symbol) | `"currency"` is the same (`1,234.56`). Turkish lira: `{ preset: "currency", country: "TR" }` (`₺1.234,56`); other symbols: `currency: "USD"` or `from` |
| `date` (value `01022020`) | value is ISO `2020-02-01` |
| `taxNumber` | `vkn` |
| `numeric` | `number` |
| `email`, `url`, `username`, `alpha`, `password`, `text`, `zipCode` | removed; validate them in your schema, or `definePreset` your own |

## Options

| v1 | v2 |
| :--- | :--- |
| `resolveMask` | `mask: (value, ctx) => string` |
| `cvv` scanning the schema for a card field | `cvv: { preset: "cvv", from: "card" }` |
| `validator: "tckn"` / `validate: true` | built into the preset; add more with `validate: (value) => true \| "my.key"` |
| `errorMessage` | errors are keys (`tckn.invalid`); map them to messages yourself |
| `currency: { decimalSeparator: ",", thousandSeparator: ".", symbol: "₺" }` | `{ preset: "currency", country: "TR" }` |
| `currency: { decimalSeparator, thousandSeparator, symbol }` (other) | `currency: { code, locale, scale }` |
| `dateFormat: "DMY"` | `date: { format: "DD/MM/YYYY" }` |
| `allowedChars`, `forbiddenChars` | custom tokens: `{ mask: "hhhh", tokens: { h: /[0-9a-f]/i } }` |
| `displayPrefix` | fixed parts kept in the value: `{TR}99 ...` |
| `placeholderChar` | removed (it never worked) |
| `onCardTypeChange` | `getCardType(form.watch("card"))` |

## Validation with a resolver

v1 mask validation silently stopped when a resolver was set. In v2 wrap the resolver:

```ts
useForm({ resolver: maskResolver(masks, zodResolver(schema)) });
```

## Helpers

| v1 | v2 |
| :--- | :--- |
| `validateTCKN`, `validateVKN`, `validateLuhn`, `validateIBAN` | `isValidTCKN`, `isValidVKN`, `isValidLuhn` / `isValidCard`, `isValidIBAN` (any country; the country code sets the length, e.g. TR → 26) |
| `applyMask`, `unmask`, `formatCurrency`... | `createMask(spec).format()` / `.parse()` |
| `mergeRefs` | removed; React 19 passes `ref` as a prop |

## Requirements

React 18.2+ (React 19 recommended), React Hook Form 7.55+, Node 20+.
