# @virastack/address

## 1.0.0

First release.

`@virastack/address` is a headless Turkish address hook: province, district and
neighbourhood chained, with the postal code derived from the neighbourhood
rather than typed. Picking a level clears the ones below it. It renders nothing,
so it works with shadcn, Ant Design, MUI or a plain `<select>` — either through
`options` and `onChange`, or through prop getters that work out `disabled` and
`loading` for you.

- Pass a React Hook Form `form` and every pick is written into it, under
  `province`, `district`, `neighbourhood` and `postalCode` unless `names` says
  otherwise. An edit form's existing address is picked up, and filling in its
  postal code does not mark the form dirty. `form.reset()`, the `values`
  option and `setValue()` on a level are followed through the form's
  `subscribe`. Nothing is imported from React Hook Form, so it is not a
  dependency.
- `@virastack/address/server` re-checks a submitted address against the dataset
  and derives the postal code where the client cannot reach it.
- `@virastack/address/data` is the dataset itself, usable without React: 81
  provinces, 973 districts and 72,466 neighbourhoods with postal codes,
  collected from PTT. Provinces and district names are bundled; a province's
  neighbourhoods load on demand, in the browser and in Node alike, so a typical
  visit downloads about 10 kB. A few hundred neighbourhoods cover several postal
  codes, and `postalCodes` keeps all of them.
- A postal code fills the address the other way round. `getPostalCodeInputProps()`
  gives an input that looks the code up once five digits are typed, or call
  `setPostalCode()`: a code with one neighbourhood fills every level, a shared
  one fills province and district and narrows the neighbourhood list to it.
  `postalCodeStatus` says which. `resolvePostalCode()` on the server and
  `findPostalCode()` in `/data` do the same lookup, and `resolveAddress()`
  checks a submitted `postalCode` against the neighbourhood.
- `formatAddress()` puts an address on one line: "Alandüzü Mah.
  Adapazarı/Sakarya", with the postal code and the separator as options.
- Turkish-aware `formatName`, `toSearchKey` and `compareNames` are exported, so sorting
  and searching handle `İ` and `ı` correctly.
