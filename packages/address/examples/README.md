# Recipes

`useViraAddress` writes into React Hook Form itself, through the `form` option,
because that is what most of its users already have. Everything else is a few
lines on top of `onChange` — kept here as recipes rather than as code we would
have to test against every upstream release.

If one of these starts carrying its weight, open an issue and it can become a
built-in.

## Formik

```tsx
import { useViraAddress } from "@virastack/address";
import { useFormikContext } from "formik";

export function AddressFields() {
  const { setFieldValue, setFieldTouched } = useFormikContext();

  const address = useViraAddress({
    onChange: (value) => {
      // Setting a cleared level to "" is what makes a required field fail again.
      setFieldValue("province", value.province ?? "");
      setFieldValue("district", value.district ?? "");
      setFieldValue("neighbourhood", value.neighbourhood ?? "");
      setFieldValue("postalCode", value.postalCode ?? "");
      setFieldTouched("province", true, false);
    },
  });

  return (
    <>
      <select {...address.getProvinceProps()} />
      <select {...address.getDistrictProps()} />
      <select {...address.getNeighbourhoodProps()} />
    </>
  );
}
```

## TanStack Form

```tsx
import { useViraAddress } from "@virastack/address";

export function AddressFields({ form }) {
  const address = useViraAddress({
    onChange: (value) => {
      form.setFieldValue("province", value.province ?? "");
      form.setFieldValue("district", value.district ?? "");
      form.setFieldValue("neighbourhood", value.neighbourhood ?? "");
      form.setFieldValue("postalCode", value.postalCode ?? "");
    },
  });

  return (
    <>
      <select {...address.getProvinceProps()} />
      <select {...address.getDistrictProps()} />
      <select {...address.getNeighbourhoodProps()} />
    </>
  );
}
```

## Plain form, no form library

The postal code is derived rather than typed, so it needs a hidden input to
reach the server:

```tsx
const address = useViraAddress();

<form action={createAddress}>
  <select {...address.getProvinceProps()} />
  <select {...address.getDistrictProps()} />
  <select {...address.getNeighbourhoodProps()} />
  <input {...address.getPostalCodeProps()} />
  <button type="submit">Kaydet</button>
</form>
```

Then check it on the server, where the client cannot reach:

```ts
import { resolveAddress } from "@virastack/address/server";

export async function createAddress(formData: FormData) {
  const { ok, value, issues } = await resolveAddress({
    province: String(formData.get("province") ?? ""),
    district: String(formData.get("district") ?? ""),
    neighbourhood: String(formData.get("neighbourhood") ?? ""),
  });
  if (!ok) return { errors: issues };
  // value.postalCode is derived here; the submitted one is ignored.
}
```

## Your own searchable select

The hook never renders anything, so the only contract is the shape of
`options`:

```tsx
const { provinces, districts, neighbourhoods, setProvince, setDistrict, setNeighbourhood, loading } = useViraAddress();

<MySearchableSelect options={provinces} onChange={setProvince} />
<MySearchableSelect options={districts} onChange={setDistrict} disabled={!districts.length} />
<MySearchableSelect
  options={neighbourhoods}
  onChange={setNeighbourhood}
  loading={loading.neighbourhoods}
/>
```

`toSearchKey` is exported for filtering, so a search for `kadikoy` matches `KADIKÖY`:

```ts
import { toSearchKey } from "@virastack/address";

const hits = neighbourhoods.filter((n) => toSearchKey(n.label).includes(toSearchKey(query)));
```
