# `@formadapter/daisyui`

A complete DaisyUI 5 adapter for FormAdapter. It renders accessible native HTML
elements with DaisyUI classes and has no React wrapper dependency.

```sh
bun add @formadapter/react @formadapter/daisyui daisyui zod
```

Enable DaisyUI and include the adapter build in Tailwind's source scan:

```css
@import "tailwindcss";
@source "../node_modules/@formadapter/daisyui/dist";
@plugin "daisyui";
```

## Set DaisyUI once

```tsx
"use client";

import { DaisyUIProvider } from "@formadapter/daisyui";

export function Providers({ children }: { children: React.ReactNode }) {
  return <DaisyUIProvider>{children}</DaisyUIProvider>;
}
```

Forms created with `createForm` from `@formadapter/react` resolve that nearest
provider automatically. A nested `FormAdapterProvider` replaces DaisyUI for its
subtree rather than merging adapters implicitly.

For a standalone form, this package also exports an adapter-bound factory:

```tsx
import { createForm } from "@formadapter/daisyui";
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

The adapter includes input, textarea, select, radio, checkbox, and file controls
plus all form, group, array, button, wizard, message, validation-summary, and
unsupported-schema slots. It reflects disabled, read-only, required, invalid,
pending, and validating state with native behavior and DaisyUI classes.

Use `daisyUIAdapter.extend(...)` to replace selected controls or slots and/or
register typed custom controls, then provide the resulting complete adapter at
the scope where it should apply.
