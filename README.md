<div align="center">

<a href="https://github.com/virastack/password" target="_blank" rel="noreferrer">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/virastack/password/main/assets/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/virastack/password/main/assets/logo-light.png">
    <img src="https://raw.githubusercontent.com/virastack/password/main/assets/logo-light.png" alt="ViraStack Password" height="120" style="max-width: 100%;" />
  </picture>
</a>

*Accessible, customizable password visibility hook for React*

[![ViraStack Password](https://img.shields.io/badge/ViraStack-Password-%23ff2056)](https://virastack.com/password/)
[![npm version](https://img.shields.io/npm/v/@virastack/password)](https://www.npmjs.com/package/@virastack/password)
[![npm downloads](https://img.shields.io/npm/dt/@virastack/password)](https://www.npmjs.com/package/@virastack/password)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/virastack/password/blob/main/LICENSE)
[![@virastack](https://img.shields.io/badge/-%40virastack-black?logo=x&logoColor=white)](https://x.com/virastack)

</div>

---

### [Read the full documentation →](https://virastack.com/password/)

## Features

- **Accessible:** ARIA attributes on the input and toggle button.
- **Customizable:** Bring your own icons, or use the built-in SVGs.
- **Safe prop merging:** Your props and handlers never get overridden.
- **State aware:** Respects `disabled` and `readOnly`.

## Quick Start

```bash
npm install @virastack/password
```

```tsx
import { useViraPassword } from '@virastack/password';

function App() {
  const { inputProps, btnProps } = useViraPassword();

  return (
    <div>
      <input {...inputProps} placeholder="Enter password" />
      <button {...btnProps} />
    </div>
  );
}
```

## API

`useViraPassword(options?)` returns `{ isVisible, toggle, inputProps, btnProps }`.

| Option | Description |
| :--- | :--- |
| `defaultVisible` | Start with the password visible |
| `disabled`, `readOnly` | Disable the toggle and mirror the state on the input |
| `icons` | `{ show, hide }` custom icons |
| `inputProps`, `btnProps` | Props merged into the generated ones |

## Ecosystem

Part of the [ViraStack](https://virastack.com) ecosystem: [Academy](https://virastack.com/academy) · [Start](https://virastack.com/start) · [AI](https://virastack.com/ai) · [Mask](https://virastack.com/mask) · [Guide](https://virastack.com/guide)

## License

[MIT](LICENSE) © [Ömer Gülçiçek](https://omergulcicek.com)
