<div align="center">

# ViraStack Form

**Headless React form hooks: input masks, passwords and Turkish addresses.**

Open source, headless and type-safe: each package renders nothing, ships its own types, and leaves inputs and styles to you. Mask and Address check field names against your form's type.

</div>

## Packages

| Package | Version | What it does |
| --- | --- | --- |
| [`@virastack/mask`](packages/mask) | [![npm](https://img.shields.io/npm/v/@virastack/mask.svg?color=605efe)](https://www.npmjs.com/package/@virastack/mask) | Zero-dependency input masks for React Hook Form, with Turkish presets (TCKN, VKN, IBAN) and server validation |
| [`@virastack/password`](packages/password) | [![npm](https://img.shields.io/npm/v/@virastack/password.svg?color=f6339a)](https://www.npmjs.com/package/@virastack/password) | Accessible password hook for React: visibility, NIST-style strength, confirmation, server validation and leaked password checks |
| [`@virastack/address`](packages/address) | [![npm](https://img.shields.io/npm/v/@virastack/address.svg?color=fb2c36)](https://www.npmjs.com/package/@virastack/address) | Headless Turkish address hook for React: chained province, district and neighbourhood selects, derived postal codes, server validation and the PTT dataset |

```bash
pnpm add @virastack/mask
pnpm add @virastack/password
pnpm add @virastack/address
```

Each package is versioned and installed on its own. Using one does not pull in the others.

## Using them together

All three write into the same React Hook Form. A checkout with a masked TCKN and
phone, a password and an address fills one set of values:

```tsx
const form = useForm<Checkout>();
const { tckn, phone } = useViraMask(form, { tckn: { preset: "tckn" }, phone: { preset: "phone", country: "TR" } });
const password = useViraPassword({ value: form.watch("password") });
const address = useViraAddress({ form });
```

`form.reset()`, `setValue()`, resolvers, `FormProvider`, field arrays and
StrictMode are covered for all three together in
[`rhf-scenarios.test.tsx`](packages/address/test/rhf-scenarios.test.tsx).

## Repository layout

```
packages/
├── mask/          → @virastack/mask
├── password/      → @virastack/password
└── address/       → @virastack/address
```

Shared infrastructure lives at the root: `tsconfig.base.json`,
`eslint.config.base.mjs`, and the catalog in `pnpm-workspace.yaml` that keeps one
version of every build tool.

```bash
pnpm install        # whole workspace
pnpm build          # every package
pnpm test           # every test
pnpm check          # typecheck + lint + coverage + build + package checks + size
```

Working on one package:

```bash
pnpm --filter @virastack/mask test
pnpm --filter @virastack/password build
```

## Releasing

Per package, with [Changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset      # describe the change and pick the bump
pnpm version        # apply versions and changelogs
pnpm release        # build, then publish only what changed
```

Releasing one package leaves the others untouched.

## Contributing

Label issues with the package they belong to — `pkg:mask`, `pkg:password`,
`pkg:address`. The "report a bug" links in each package README add the label for
you.

## Ecosystem

Part of the [ViraStack](https://virastack.com) ecosystem: [Academy](https://github.com/virastack/academy) · [Start](https://github.com/virastack/start) · [AI](https://github.com/virastack/ai) · [Guide](https://github.com/virastack/guide)

## License

[MIT](LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
