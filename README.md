<div align="center">

# ViraStack Form

**Türkiye'ye özel, erişilebilir React form primitifleri.**

Maskeler, şifre akışları ve adres seçimi — hepsi headless, hepsi TypeScript.

</div>

## Paketler

| Paket | Sürüm | Ne yapar |
| --- | --- | --- |
| [`@virastack/mask`](packages/mask) | [![npm](https://img.shields.io/npm/v/@virastack/mask.svg)](https://www.npmjs.com/package/@virastack/mask) | React Hook Form için sıfır konfigürasyonlu input maskeleri; TC, VKN, IBAN, telefon, kart ve para birimi doğrulayıcıları, sunucu desteği |
| [`@virastack/password`](packages/password) | [![npm](https://img.shields.io/npm/v/@virastack/password.svg)](https://www.npmjs.com/package/@virastack/password) | Erişilebilir şifre hook'u: görünürlük, NIST ölçütlü güç hesabı, onay alanı, sunucu doğrulaması ve sızmış şifre kontrolü |

## Kurulum

```bash
pnpm add @virastack/mask
pnpm add @virastack/password
```

Her paket bağımsız sürümlenir ve tek tek kurulur. Birini kullanmak diğerini getirmez.

## Monorepo

```
packages/
├── mask/      → @virastack/mask
└── password/  → @virastack/password
```

Ortak altyapı kökte durur: `tsconfig.base.json`, `eslint.config.base.mjs` ve
`pnpm-workspace.yaml` içindeki katalog (araç sürümleri için tek kaynak).

```bash
pnpm install        # tüm workspace
pnpm build          # tüm paketler
pnpm test           # tüm testler
pnpm check          # typecheck + lint + coverage + build + paket kontrolü + boyut
```

Tek pakette çalışmak için:

```bash
pnpm --filter @virastack/mask test
pnpm --filter @virastack/password build
```

### Sürüm çıkarma

[Changesets](https://github.com/changesets/changesets) ile, paket bazlı:

```bash
pnpm changeset      # değişikliği ve bump türünü anlat
pnpm version        # sürümleri ve CHANGELOG'ları güncelle
pnpm release        # build + yalnızca değişen paketleri yayınla
```

Bir pakette sürüm çıkmak diğerlerini etkilemez.

## Katkı

Issue açarken paketi `pkg:mask` / `pkg:password` etiketiyle belirt — paket
README'lerindeki "Bug bildir" bağlantıları bunu kendiliğinden ekler.

## Lisans

[MIT](LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
