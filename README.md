<div align="center">

# ViraStack Form

**Accessible React form primitives built for Türkiye.**

Input masks, password flows and address selection — headless, typed, framework-agnostic.

</div>

## Packages

| Package | Version | What it does |
| --- | --- | --- |
| [`@virastack/mask`](packages/mask) | [![npm](https://img.shields.io/npm/v/@virastack/mask.svg)](https://www.npmjs.com/package/@virastack/mask) | Zero-config input masks for React Hook Form, with Turkish validators (TCKN, VKN, IBAN, phone, card, currency) and server support |
| [`@virastack/password`](packages/password) | [![npm](https://img.shields.io/npm/v/@virastack/password.svg)](https://www.npmjs.com/package/@virastack/password) | Accessible password hook: visibility, NIST-style strength, confirmation, server validation and leaked password checks |
| [`@virastack/address`](packages/address) | [![npm](https://img.shields.io/npm/v/@virastack/address.svg)](https://www.npmjs.com/package/@virastack/address) | Headless province, district and neighbourhood hook with derived postal codes, server validation and the PTT dataset behind it |

```bash
pnpm add @virastack/mask
pnpm add @virastack/password
pnpm add @virastack/address
```

Each package is versioned and installed on its own. Using one does not pull in the others.

## Repository layout

```
packages/
├── mask/          → @virastack/mask
├── password/      → @virastack/password
└── address/       → @virastack/address (unreleased)
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

## License

[MIT](LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
