# `@formadapter/html`

The accessible, unstyled native HTML adapter for FormAdapter. Use it as a
ready-to-render default or as the foundation for your own design system.

```sh
bun add @formadapter/react @formadapter/html zod
```

## Set the adapter once

```tsx
"use client";

import { HTMLProvider } from "@formadapter/html";

export function Providers({ children }: { children: React.ReactNode }) {
  return <HTMLProvider>{children}</HTMLProvider>;
}
```

Forms created with `createForm` from `@formadapter/react` use the nearest
provider. A nested provider replaces its parent adapter for that subtree.

For an HTML fallback that works without a provider, import the adapter-bound
factory instead. A nearest provider still overrides that fallback:

```tsx
import { createForm } from "@formadapter/html";
import { z } from "zod";

const Contact = createForm(z.object({
  email: z.email(),
  message: z.string(),
})).configure({
  fields: { message: { control: "textarea" } },
});

export function ContactForm() {
  return <Contact.Form onSubmit={(values) => console.log(values)} />;
}
```

The adapter covers every built-in control and every visible slot: nested
groups, arrays, error summaries, form messages, unsupported schema nodes, and
wizards. It emits semantic HTML and accessibility attributes without classes
or layout styles. Classes, styles, and safe native attributes configured on
fields pass through untouched.

## Build your design system

Extend the complete adapter and replace only the pieces your system owns:

```tsx
import { htmlAdapter } from "@formadapter/html";

export const productAdapter = htmlAdapter.extend({
  name: "Product UI",
  slots: { Button: ProductButton },
  controls: { custom: { rating: RatingControl } },
});
```

`extend` returns a new complete adapter and never mutates `htmlAdapter`.
Individual controls and slots are exported for direct reuse.

The framework-free control normalization helpers used by native adapters are
available from `@formadapter/html/native`. This keeps the root component API
small while giving custom native renderers one tested implementation for input
types, values, safe `controlProps`, and typed option serialization.
