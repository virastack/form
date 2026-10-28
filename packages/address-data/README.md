<div align="center">

# @virastack/address-data

**Turkish provinces, districts and neighbourhoods with postal codes.**

</div>

Plain data for [`@virastack/address`](../address). Provinces and district names
are bundled; neighbourhoods are split into one module per province and loaded
only when that province is picked.

```bash
pnpm add @virastack/address-data
```

```ts
import { provinces, districts, neighbourhoods, source } from "@virastack/address-data";

provinces.length;          // 81
districts(34);             // ["ADALAR", "ARNAVUTKÖY", ...]

const byDistrict = await neighbourhoods(34);
byDistrict.get("FATİH");   // [{ name: "AKSARAY MAH.", postalCode: "34096" }, ...]

source.date;               // "2026-10-28" — when the data was collected
```

## Why it is shaped this way

The source lists every street, which is far more than an address form needs, so
the build reduces it to unique neighbourhoods with their postal code. Each
province ships as a single encoded string instead of nested JSON: it is smaller
over the wire, and splitting a string beats parsing an array of objects.

Most neighbourhoods carry one postal code. A few hundred carry several — up to
eight — and all of them are kept, so `postalCodes` is the honest answer and
`postalCode` is the first one for the common case.

## What it costs

81 provinces, 973 districts, 72,466 neighbourhoods.

| | gzip |
| --- | --- |
| `index.json`, bundled | 5.3 kB |
| One province, median | 4.6 kB |
| One province, p90 | 9.2 kB |
| One province, largest (Kastamonu, 4,318 settlements) | 28.5 kB |

75 of 81 provinces are under 10 kB, so a typical visit downloads about **10 kB**
— the index plus the province that was picked. Rural provinces with thousands
of villages are the outliers, not the big cities: İstanbul is far from the worst.

The build fails if the largest province passes 30 kB, so a data refresh cannot
quietly make the payload worse.

## Reading the data somewhere else

`neighbourhoods()` imports the generated module by default. Point it at disk, a
CDN or your own endpoint instead:

```ts
import { setLoader } from "@virastack/address-data";

setLoader(async (provinceCode) => fetch(`/api/address/${provinceCode}`).then((r) => r.text()));
```

## Regenerating

```bash
pnpm data:build   # raw/ptt-dump.json -> data/
```

The dump itself is not committed: it is large and reproducible. The build prints
per-province sizes so a jump in payload is visible in review.

## Data source

Collected from [PTT](https://www.ptt.gov.tr/posta-kodu), Türkiye's postal
service. Names and postal codes are public reference data; this package only
reshapes them. Verify against PTT before relying on it for delivery-critical
work.

## License

[MIT](../../LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
