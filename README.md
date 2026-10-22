<div align="center">

<a href="https://github.com/virastack/mask" target="_blank" rel="noreferrer">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/virastack/mask/main/assets/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/virastack/mask/main/assets/logo-light.png">
    <img src="https://raw.githubusercontent.com/virastack/mask/main/assets/logo-light.png" alt="ViraStack Mask" height="120" style="max-width: 100%;" />
  </picture>
</a>

*Zero-dependency input masking for React Hook Form: phone, credit card, currency and more*

[![ViraStack Mask](https://img.shields.io/badge/ViraStack-Mask-%23615fff)](https://virastack.com/mask/)
[![npm version](https://img.shields.io/npm/v/@virastack/mask)](https://www.npmjs.com/package/@virastack/mask)
[![npm downloads](https://img.shields.io/npm/dt/@virastack/mask)](https://www.npmjs.com/package/@virastack/mask)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/virastack/mask/blob/main/LICENSE)
[![@virastack](https://img.shields.io/badge/-%40virastack-black?logo=x&logoColor=white)](https://x.com/virastack)

</div>

---

### [Read the full documentation →](https://virastack.com/mask/)

## Features

- **Lightweight:** ~5KB minified.
- **React Hook Form:** Works with your form state, no extra syncing.
- **Type-safe:** Typed schema, options and presets.
- **Presets:** Card, phone, currency, IBAN and more.

## Quick Start

```bash
npm install @virastack/mask
```

```tsx
import { useForm } from 'react-hook-form';
import { useViraMask } from '@virastack/mask';

function App() {
  const form = useForm();

  const { phone } = useViraMask({
    form,
    schema: {
      phone: 'phone'
    }
  });

  return (
    <form>
      <input {...phone} placeholder="(555) 555-5555" />
    </form>
  );
}
```

## API

`useViraMask({ form, schema })` returns one field object per schema key. Spread it on an `<input>`.

| Schema value | Description |
| :--- | :--- |
| Preset name | `card`, `expiry`, `cvv`, `phone`, `currency`, `iban`, `date`, `zipCode`, `numeric` and more |
| Options object | `mask`, `transform`, `allowedChars`, `currency`, `validator`, `preset` and more |

Each field also exposes `rawValue`, the unmasked value.

## Ecosystem

Part of the [ViraStack](https://virastack.com) ecosystem.

## License

[MIT](LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
