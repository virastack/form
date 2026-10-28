---
"@virastack/address": minor
"@virastack/address-data": minor
---

First release.

`@virastack/address` is a headless Turkish address hook: province, district and
neighbourhood chained, with the postal code derived from the neighbourhood
rather than typed. Picking a level clears the ones below it. It renders nothing,
so it works with shadcn, Ant Design, MUI or a plain `<select>` — either through
`options` and `onChange`, or through prop getters that work out `disabled` and
`loading` for you.

- `@virastack/address/rhf` mirrors the selection into React Hook Form, which
  stays an optional peer dependency.
- `@virastack/address/server` re-checks a submitted address against the dataset
  and derives the postal code where the client cannot reach it.
- Turkish-aware `titleCaseTr`, `foldTr` and `compareTr` are exported, so sorting
  and searching handle `İ` and `ı` correctly.

`@virastack/address-data` carries the data behind it: 81 provinces, 973
districts and 72,466 neighbourhoods with postal codes, collected from PTT.
Provinces and district names are bundled; a province's neighbourhoods load on
demand, so a typical visit downloads about 10 kB. A few hundred neighbourhoods
cover several postal codes, and `postalCodes` keeps all of them.
