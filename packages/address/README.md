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
      <select onChange={(e) => setProvince(e.target.value)}>
        <option value="">İl seçiniz</option>
        {provinces.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>

      <select onChange={(e) => setDistrict(e.target.value)} disabled={!districts.length}>
        <option value="">İlçe seçiniz</option>
        {districts.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>

      <select onChange={(e) => setNeighbourhood(e.target.value)} disabled={!neighbourhoods.length}>
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
<Select {...getProvinceProps({ as: "shadcn" })} />   {/* onValueChange */}
<Select {...getProvinceProps({ as: "antd" })} />     {/* showSearch, optionFilterProp */}
<select {...getProvinceProps({ as: "native" })} />
```

The default flavour is library-agnostic: `options` plus `onChange(value)`.

Rendering is yours. A district like Konya's can hold a few thousand
neighbourhoods, so virtualise the list if your select does not already.

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

Inside a `FormProvider` nothing else is needed; otherwise pass `setValue`.
Clearing a level clears it in the form too, with `shouldDirty`, `shouldTouch`
and `shouldValidate` set, so a required district cannot stay valid after the
province changes.

Formik and TanStack Form are not shipped as adapters, but the core hook works
with both — see [`examples/`](./examples) for a recipe.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `source` | bundled dataset | Where the lists come from. Swap it for a fixture or your own endpoint. |
| `defaultValue` | — | `{ provinceCode, district, neighbourhood }` to start from. |
| `formatLabel` | `titleCaseTr` | Turns a raw name into a label. Pass `(name) => name` to keep the dataset's upper case. |
| `onChange` | — | Called with the whole `value` on every change, not on first render. |
| `names` | level names | Field names the prop getters emit. |

Also returned: `reset()`, `error` and `loading.neighbourhoods`.

## Server

A client can post any postal code it likes, so check it where it counts:

```ts
import { resolveAddress } from "@virastack/address/server";

const { ok, value, issues } = await resolveAddress({
  province: "istanbul",        // code or name, any casing
  district: "fatih",
  neighbourhood: "aksaray mah.",
});

if (!ok) return { errors: issues };  // [{ level: "district", reason: "unknown" }]
value.postalCode;                    // "34096" — derived here, not trusted
```

This entry has no React and no `"use client"`, so Server Components and Server
Actions can call it. `districtsOf()` and `findProvince()` are there too.

## Data

Names and postal codes come from [`@virastack/address-data`](../address-data),
collected from [PTT](https://www.ptt.gov.tr/posta-kodu). It is versioned
separately, so a data refresh is a patch release that needs no change here.

Provinces and district names are bundled. Neighbourhoods are split into one
module per province and imported when that province is picked, which keeps the
initial payload small.

## Ecosystem

Part of the [ViraStack](https://virastack.com) ecosystem: [Academy](https://github.com/virastack/academy) · [Start](https://github.com/virastack/start) · [AI](https://github.com/virastack/ai) · [Mask](https://github.com/virastack/form/tree/main/packages/mask) · [Password](https://github.com/virastack/form/tree/main/packages/password) · [Guide](https://github.com/virastack/guide)

## License

[MIT](https://github.com/virastack/form/blob/main/LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
