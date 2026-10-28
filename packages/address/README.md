<div align="center">

# ViraStack Address

*Headless Turkish address hook for React: province, district and neighbourhood with postal code*

[![ViraStack Address](https://img.shields.io/badge/ViraStack-Address-%2300bba7)](https://virastack.com/address/)
[![npm version](https://img.shields.io/npm/v/@virastack/address)](https://www.npmjs.com/package/@virastack/address)
[![npm downloads](https://img.shields.io/npm/dt/@virastack/address)](https://www.npmjs.com/package/@virastack/address)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/virastack/form/blob/main/LICENSE)
[![@virastack](https://img.shields.io/badge/-%40virastack-black?logo=x&logoColor=white)](https://x.com/virastack)

</div>

### [Read the full documentation →](https://virastack.com/address/)

## Features

- **Il → ilçe → mahalle**, chained. Picking a province clears what was below it.
- **Postal code derived**, not typed. Selecting a neighbourhood fills it.
- **Headless.** No components, no styles: works with shadcn, Ant Design, MUI or a plain `<select>`.
- **Data included.** 81 provinces, 973 districts and 72,466 neighbourhoods with postal codes, usable without React from `/data`.
- **Loaded on demand.** Provinces and districts ship with the package; a province's neighbourhoods arrive when it is picked.
- **Turkish-aware.** Sorting, case folding and title case all respect `İ` and `ı`.
- **React Hook Form optional.** The core needs nothing but React; `/rhf` is a separate entry.
- **Server-side validation.** Re-check a submitted address and derive its postal code where the client cannot reach.

## Quick Start

```bash
pnpm add @virastack/address
```

```tsx
import { useViraAddress } from "@virastack/address";

function AddressFields() {
  const {
    provinces, districts, neighbourhoods,
    setProvince, setDistrict, setNeighbourhood,
    value, loading,
  } = useViraAddress();

  return (
    <>
      <select value={value.provinceCode ?? ""} onChange={(e) => setProvince(e.target.value)}>
        <option value="">İl seçiniz</option>
        {provinces.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>

      <select value={value.district ?? ""} onChange={(e) => setDistrict(e.target.value)} disabled={!districts.length}>
        <option value="">İlçe seçiniz</option>
        {districts.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>

      <select
        value={value.neighbourhood ?? ""}
        onChange={(e) => setNeighbourhood(e.target.value)}
        disabled={!neighbourhoods.length}
      >
        <option value="">{loading.neighbourhoods ? "Yükleniyor…" : "Mahalle seçiniz"}</option>
        {neighbourhoods.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
      </select>

      <input type="text" value={value.postalCode ?? ""} readOnly />
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

Every list is `{ value, label }`, so it drops into any select. `value` carries the
raw name as the dataset spells it; `label` is title-cased for display.

## Prop getters

When you would rather not wire `disabled` and `loading` yourself:

```tsx
const { getProvinceProps, getDistrictProps, getNeighbourhoodProps } = useViraAddress();

<MySearchableSelect {...getProvinceProps()} />
<MySearchableSelect {...getDistrictProps()} />
<MySearchableSelect {...getNeighbourhoodProps()} />
```

Each getter returns `options`, `value`, `onChange`, `disabled`, `loading`,
`aria-busy`, `name`, `id` and `placeholder`. `disabled` and `loading` are worked
out from the chain; override any of them:

```tsx
<MySearchableSelect {...getDistrictProps({ disabled: false, placeholder: "Nerede?" })} />
<MySearchableSelect {...getDistrictProps()} disabled={false} />
```

`onChange` takes a bare value or a change event, so native inputs work unchanged.

## UI libraries

Prop names differ between libraries. Pick the flavour instead of remapping by hand:

```tsx
// Native: the options are rendered for you; the empty first one is the placeholder.
<select {...getProvinceProps({ as: "native" })} />

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

The default flavour is library-agnostic: `options` plus `onChange(value)`.

Rendering is yours. A district can hold several hundred neighbourhoods and
villages (Artvin's Yusufeli has 674), so a searchable select pays off there.

## React Hook Form

```tsx
import { useViraAddressField } from "@virastack/address/rhf";

function AddressFields() {
  const { getProvinceProps, getDistrictProps, getNeighbourhoodProps } = useViraAddressField({
    names: {
      province: "address.province",
      district: "address.district",
      neighbourhood: "address.neighbourhood",
      postalCode: "address.postalCode",
    },
  });

  return (
    <>
      <select {...getProvinceProps({ as: "native" })} />
      <select {...getDistrictProps({ as: "native" })} />
      <select {...getNeighbourhoodProps({ as: "native" })} />
    </>
  );
}
```

Inside a `FormProvider` nothing else is needed; otherwise pass `setValue`, and
`defaultValue` if the form starts filled. Clearing a level clears it in the form
too, with `shouldDirty`, `shouldTouch` and `shouldValidate` set, so a required
district cannot stay valid after the province changes.

An edit form works as it is: the hook starts from the address already in the
form's values, matching names however they were cased, and filling in the
postal code once the neighbourhoods arrive does not mark the form dirty.

Formik and TanStack Form are not shipped as adapters, but the core hook works
with both — see [`examples/`](./examples) for a recipe.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `source` | bundled dataset | Where the lists come from. Swap it for a fixture or your own endpoint. |
| `defaultValue` | — | `{ provinceCode, district, neighbourhood }` to start from. `/rhf` reads it from the form when omitted. |
| `formatLabel` | `titleCaseTr` | Turns a raw name into a label. Pass `(name) => name` to keep the dataset's upper case. |
| `onChange` | — | Called with the whole `value` on every change, not on first render. |
| `names` | level names | Field names the prop getters emit. |

Also returned: `reset()`, `error` and `loading.neighbourhoods`.

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

This entry has no React and no `"use client"`, so Server Components and Server
Actions can call it. `districtsOf()` and `findProvince()` are there too.

## Data

The dataset behind the hook ships in this package, and needs no React:

```ts
import { provinces, districts, neighbourhoods, source } from "@virastack/address/data";

provinces.length;          // 81
districts(34);             // ["ADALAR", "ARNAVUTKÖY", ...]

const byDistrict = await neighbourhoods(34);
byDistrict.get("FATİH");   // [{ name: "AKSARAY MAH.", postalCode: "34096", postalCodes: ["34096"] }, ...]

source.date;               // "2026-10-28", when the data was collected
```

Province and district names are bundled. Each province's neighbourhoods are a
module of their own, imported the first time that province is picked: your
bundler splits them into one lazy chunk each, and in Node both `import` and
`require()` read one province at a time.

Most neighbourhoods carry one postal code. A few hundred carry several, up to
eight, and all of them are kept: `postalCodes` is the honest answer and
`postalCode` the first one, for the common case.

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
