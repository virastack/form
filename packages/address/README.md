<div align="center">

<a href="https://github.com/virastack/form/tree/main/packages/address" target="_blank" rel="noreferrer">
  <img src="https://raw.githubusercontent.com/virastack/form/main/packages/address/assets/logo.png" alt="ViraStack Address" height="120" style="max-width: 100%;" />
</a>

*Headless Turkish address hook for React: chained province, district and neighbourhood selects, derived postal codes, server validation and the PTT dataset*

[![ViraStack Address](https://img.shields.io/badge/ViraStack-Address-%23fb2c36)](https://virastack.com/address/)
[![npm version](https://img.shields.io/npm/v/@virastack/address)](https://www.npmjs.com/package/@virastack/address)
[![npm downloads](https://img.shields.io/npm/dt/@virastack/address)](https://www.npmjs.com/package/@virastack/address)
[![License: MIT](https://img.shields.io/github/license/virastack/form)](https://github.com/virastack/form/blob/main/LICENSE)
[![@virastack](https://img.shields.io/badge/-%40virastack-555?logo=x&logoColor=white)](https://x.com/virastack)

</div>

---

### [Read the full documentation →](https://virastack.com/address/)

## Features

- **Il → ilçe → mahalle**, chained. Picking a province clears what was below it.
- **Postal code derived**, not typed. Selecting a neighbourhood fills it.
- **Or the other way round.** Type a postal code and the selects fill in: all three when the code has one neighbourhood, province and district otherwise.
- **One-line address.** `formatAddress()` turns the pick into "Alandüzü Mah. Adapazarı/Sakarya".
- **Headless.** No components, no styles: works with shadcn, Ant Design, MUI or a plain `<select>`.
- **Data included.** 81 provinces, 973 districts and 72,466 neighbourhoods with postal codes, usable without React from `/data`.
- **Loaded on demand.** Provinces and districts ship with the package; a province's neighbourhoods arrive when it is picked.
- **Turkish-aware.** Sorting, case folding and title case all respect `İ` and `ı`.
- **React Hook Form built in, not required.** Pass `form` and every pick lands in it; nothing is imported from React Hook Form.
- **Server-side validation.** Re-check a submitted address and derive its postal code where the client cannot reach.

## Quick Start

```bash
pnpm add @virastack/address
```

```tsx
import { useViraAddress } from "@virastack/address";

function AddressFields() {
  const {
    getProvinceProps,
    getDistrictProps,
    getNeighbourhoodProps,
    value,
  } = useViraAddress();

  return (
    <>
      <select {...getProvinceProps()} />
      <select {...getDistrictProps()} />
      <select {...getNeighbourhoodProps()} />
      <p>Posta kodu: {value.postalCode ?? "—"}</p>
    </>
  );
}
```

`value` is everything the form needs:

```ts
{
  provinceCode: "34",
  province: "İSTANBUL",
  district: "FATİH",
  neighbourhood: "AKSARAY MAH.",
  postalCode: "34096",
  postalCodes: ["34096"],   // all of them, for the few hundred that have several
}
```

The hook also returns the lists and setters (`provinces`, `setProvince`, …) for
wiring a select yourself. Every list is `{ value, label }`: `value` carries the
raw name as the dataset spells it; `label` is title-cased for display.

## Prop getters

Each getter fills a plain `<select>`: its options, with an empty first one as
the placeholder, plus `value`, `onChange`, `disabled`, `aria-busy`, `name` and
`id`. `disabled` and `aria-busy` are worked out from the chain: the district
waits for a province, the neighbourhood for a district and its data. Override
any of them:

```tsx
<select {...getDistrictProps({ placeholder: "Nerede?" })} />
<select {...getDistrictProps()} disabled={false} />
```

`onChange` takes a bare value or a change event.

## UI libraries

Other components want other props. Pick the flavour instead of remapping by hand:

```tsx
// Your own component: options plus onChange(value), loading and placeholder.
<MySearchableSelect {...getProvinceProps({ as: "headless" })} />

// Ant Design: options, loading, and a search where "istanbul" finds "İstanbul".
<Select {...getProvinceProps({ as: "antd" })} />

// shadcn/ui: value, onValueChange and disabled go on Select; the items are yours.
<Select {...getProvinceProps({ as: "shadcn" })}>
  <SelectTrigger><SelectValue placeholder="İl seçiniz" /></SelectTrigger>
  <SelectContent>
    {provinces.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
  </SelectContent>
</Select>
```

Rendering is yours. A district can hold several hundred neighbourhoods and
villages (Artvin's Yusufeli has 674), so a searchable select pays off there.

## React Hook Form

Pass the form and the fields fill themselves:

```tsx
import { useForm } from "react-hook-form";
import { useViraAddress } from "@virastack/address";

function AddressForm() {
  const form = useForm<{ province: string; district: string; neighbourhood: string; postalCode: string }>();
  const { getProvinceProps, getDistrictProps, getNeighbourhoodProps } = useViraAddress({ form });

  return (
    <form onSubmit={form.handleSubmit(save)}>
      <select {...getProvinceProps()} />
      <select {...getDistrictProps()} />
      <select {...getNeighbourhoodProps()} />
    </form>
  );
}
```

The fields are `province`, `district`, `neighbourhood` and `postalCode` unless
you say otherwise. `names` is only for a form shaped differently, and
TypeScript checks each one against the form:

```tsx
useViraAddress({
  form,
  names: {
    province: "address.il",
    district: "address.ilce",
    neighbourhood: "address.mahalle",
    postalCode: "address.postaKodu",
  },
});
```

Inside a `FormProvider`, pass `form: useFormContext()`. Add `provinceCode` to
`names` when the backend wants the plate code as well.

Clearing a level clears it in the form too, with `shouldDirty`, `shouldTouch`
and `shouldValidate` set, so a required district cannot stay valid after the
province changes.

An edit form works as it is: the hook starts from the address already in the
form's values, matching names however they were cased, and filling in the
postal code once the neighbourhoods arrive does not mark the form dirty. Data
that arrives later is followed too: `form.reset(data)`, the `values` option and
`setValue()` on a level move the selects without dirtying the form, and
`form.reset()` to empty values clears the address with everything else.

`form` is anything with `setValue(name, value, options)`, plus `getValues(name)`
if it should start filled and `subscribe` if it should follow `reset()`, so
React Hook Form (7.55+ for `subscribe`) is never imported. Formik and
TanStack Form name these differently; see [`examples/`](./examples) for a recipe.

## From a postal code

The address can also be filled from a postal code instead of the selects. Add
an input for it and the selects follow:

```tsx
const { getProvinceProps, getDistrictProps, getNeighbourhoodProps, getPostalCodeInputProps, postalCodeStatus } =
  useViraAddress({ form });

<input {...getPostalCodeInputProps()} />
{postalCodeStatus === "unknown" && <p>Bu posta kodu bulunamadı.</p>}
```

A postal code always belongs to one district, but often to several
neighbourhoods: of 2,777 codes, 205 have exactly one. So a lookup fills in what
the code can say for certain:

| `postalCodeStatus` | What happened |
| --- | --- |
| `"exact"` | One neighbourhood under the code: province, district and neighbourhood are filled. |
| `"partial"` | Province and district are filled; the neighbourhood list is narrowed to the code and the user picks one. A neighbourhood already picked under the code is kept. |
| `"unknown"` | Not a code in the dataset. Nothing changes and the input gets `aria-invalid`. |
| `"loading"` | The code's province is loading. Only that one province is read. |

The input shows the derived code after a pick in the selects, strips anything
that is not a digit and looks the code up once five digits are in. Picking a
province or district by hand drops the lookup again. For a neighbourhood that
spans several codes, `value.postalCode` is the one the user typed.

Without the input, call `setPostalCode("34710")` yourself; it resolves with the
status. `setPostalCode(null)` drops the lookup and keeps the address.

## Address line

`formatAddress` puts the picked address on one line, for an order summary, an
invoice or a cargo label:

```ts
import { formatAddress } from "@virastack/address";

formatAddress(value);                        // "Alandüzü Mah. Adapazarı/Sakarya"
formatAddress(value, { postalCode: true });  // "Alandüzü Mah. 54100 Adapazarı/Sakarya"
formatAddress(value, { separator: ", " });   // "Alandüzü Mah. Adapazarı, Sakarya"
```

Names are Turkish title cased with `formatName`, and a level not picked yet is
left out, so a half-filled form still reads cleanly ("Adapazarı/Sakarya"). It
takes the hook's `value`, a `resolveAddress` result's `value` or your own
object, and is exported from `/server` too.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `source` | bundled dataset | Where the lists come from. Swap it for a fixture or your own endpoint. |
| `defaultValue` | — | `{ provinceCode, district, neighbourhood }` to start from. With `form`, read from the form when omitted. |
| `formatLabel` | `formatName` | Turns a raw name into a label. Pass `(name) => name` to keep the dataset's upper case. |
| `onChange` | — | Called with the whole `value` on every change, not on first render. |
| `form` | — | A form to keep in step, such as `useForm()`. See [React Hook Form](#react-hook-form). |
| `names` | `province`, `district`, `neighbourhood`, `postalCode` | Field names, in the form and on the inputs the prop getters return. `provinceCode` is written only when named. |
| `shouldValidate` | `true` | Revalidate form fields as the address changes. |

Also returned: `reset()`, `error`, `loading.neighbourhoods`, `setPostalCode()`,
`postalCodeStatus` and `getPostalCodeInputProps()` (see [From a postal code](#from-a-postal-code)).

## Server

A client can post any postal code it likes, so check it where it counts:

```ts
import { resolveAddress } from "@virastack/address/server";

const { ok, value, issues } = await resolveAddress({
  province: "istanbul",        // name in any casing, or a plate code: 34, "34", "06"
  district: "fatih",
  neighbourhood: "aksaray mah.",
});

if (!ok) return { errors: issues };  // [{ level: "district", reason: "unknown" }]
value.postalCode;                    // "34096" — derived here, not trusted
```

Pass the `postalCode` the form sent and it is checked too: a code that is not
one of the neighbourhood's gives `{ level: "postalCode", reason: "mismatch" }`,
and for a neighbourhood with several codes the one sent is kept.

To answer a postal code lookup on the server, `resolvePostalCode` gives as much
of the address as the code can say, and the candidates:

```ts
import { resolvePostalCode } from "@virastack/address/server";

const { ok, value, neighbourhoods } = await resolvePostalCode("34096");
// ok: false, issues: [{ level: "neighbourhood", reason: "missing" }]
// value: { province: "İSTANBUL", district: "FATİH", neighbourhood: null, postalCode: "34096", ... }
// neighbourhoods: ["AKSARAY MAH.", "HASEKİ SULTAN MAH."]
```

This entry has no React and no `"use client"`, so Server Components and Server
Actions can call it. `districtsOf()`, `findProvince()`, `formatAddress()` and
`normalizePostalCode()` are there too.

## Data

The dataset behind the hook ships in this package, and needs no React:

```ts
import { provinces, districts, neighbourhoods, findPostalCode, source } from "@virastack/address/data";

provinces.length;          // 81
districts(34);             // ["ADALAR", "ARNAVUTKÖY", ...]

const byDistrict = await neighbourhoods(34);
byDistrict.get("FATİH");   // [{ name: "AKSARAY MAH.", postalCode: "34096", postalCodes: ["34096"] }, ...]

source.date;               // "2026-10-28", when the data was collected

await findPostalCode("34710");
// { postalCode: "34710", province: { code: 34, name: "İSTANBUL", ... }, district: "KADIKÖY",
//   neighbourhoods: [{ name: "CAFERAĞA MAH.", ... }] }
```

Province and district names are bundled. Each province's neighbourhoods are a
module of their own, imported the first time that province is picked: your
bundler splits them into one lazy chunk each, and in Node both `import` and
`require()` read one province at a time.

Most neighbourhoods carry one postal code. A few hundred carry several, up to
eight, and all of them are kept: `postalCodes` is the honest answer and
`postalCode` the first one, for the common case.

Every postal code starts with its province's plate code and stays within one
district. The data build fails if a refresh ever breaks either rule, since the
postal code lookup reads only that one province.

### What it costs

81 provinces, 973 districts, 72,466 neighbourhoods.

| | gzip |
| --- | --- |
| Province and district names, bundled | 5.3 kB |
| One province, median | 4.6 kB |
| One province, p90 | 9.2 kB |
| One province, largest (Kastamonu, 4,318 settlements) | 28.5 kB |

75 of 81 provinces are under 10 kB, so a typical visit downloads about **10 kB**:
the names plus the province that was picked. Rural provinces with thousands of
villages are the outliers, not the big cities. The data build fails if the
largest province passes 30 kB, so a refresh cannot quietly make it worse.

### Reading it from somewhere else

Point the loader at disk, a CDN or your own endpoint. It returns the province's
encoded payload, and the hook and `/server` read through it too:

```ts
import { setLoader } from "@virastack/address/data";

setLoader(async (provinceCode) => fetch(`/api/address/${provinceCode}`).then((r) => r.text()));
```

### Source and refreshes

Collected from [PTT](https://www.ptt.gov.tr/posta-kodu), Türkiye's postal
service. Names and postal codes are public reference data; this package only
reshapes them. Verify against PTT before relying on it for delivery-critical
work.

A data refresh is a patch release. To regenerate from a new harvest:

```bash
pnpm data:build   # raw/ptt-dump.json -> data/
```

The dump itself is not committed: it is large and reproducible. The build prints
per-province sizes, so a jump in payload is visible in review.

## Ecosystem

Part of the [ViraStack](https://virastack.com) ecosystem: [Academy](https://github.com/virastack/academy) · [Start](https://github.com/virastack/start) · [AI](https://github.com/virastack/ai) · [Mask](https://github.com/virastack/form/tree/main/packages/mask) · [Password](https://github.com/virastack/form/tree/main/packages/password) · [Guide](https://github.com/virastack/guide)

## License

[MIT](https://github.com/virastack/form/blob/main/LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
