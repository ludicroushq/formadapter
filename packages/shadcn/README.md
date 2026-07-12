# `@formadapter/shadcn`

Connect FormAdapter to the shadcn/ui components your application owns. Nothing
is styled or copied by this package: pass your generated components once and
FormAdapter renders those exact components.

```sh
bun add @formadapter/react @formadapter/shadcn
bunx shadcn@latest add alert button checkbox field input native-select progress radio-group spinner textarea
```

Use the entry point matching the primitives selected in `components.json`:

```tsx
"use client";

import { createShadcn } from "@formadapter/shadcn/baseui";
// For Radix UI instead:
// import { createShadcn } from "@formadapter/shadcn/radix";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup,
  FieldLabel, FieldLegend, FieldSet, FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export const shadcn = createShadcn({
  Alert, AlertDescription, AlertTitle, Button, Checkbox,
  Field, FieldContent, FieldDescription, FieldError, FieldGroup,
  FieldLabel, FieldLegend, FieldSet, FieldTitle,
  Input, NativeSelect, NativeSelectOption, Progress,
  RadioGroup, RadioGroupItem, Spinner, Textarea,
});

export const ShadcnProvider = shadcn.Provider;
```

Mount the returned provider once. Neutral forms created with
`@formadapter/react` use the nearest provider:

```tsx
<ShadcnProvider>
  <App />
</ShadcnProvider>
```

The setup also returns `adapter` for scoped extensions and an adapter-bound
`createForm` for forms that should not depend on a provider:

```tsx
export const { adapter, createForm } = shadcn;
```

Do not import CSS from `@formadapter/shadcn`. Your generated components and
existing shadcn theme remain the only styling source.
