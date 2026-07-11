# `@formadapter/shadcn`

Complete shadcn/ui-styled adapter for FormAdapter. It renders accessible native
controls with shadcn styling and your app's existing theme tokens.

```sh
bun add @formadapter/react @formadapter/shadcn
```

Include the package in Tailwind's source scan:

```css
@import "tailwindcss";
@import "@formadapter/shadcn";
```

Provide it once near the root of the client tree:

```tsx
"use client";

import { ShadcnProvider } from "@formadapter/shadcn";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ShadcnProvider>{children}</ShadcnProvider>;
}
```

The package does not import or overwrite source-owned `components/ui` files.
Extend `shadcnAdapter` when a scope should render a local component instead.
