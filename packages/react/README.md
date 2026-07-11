# `@formadapter/react`

Typed React form state, schema-bound components, provider-scoped UI adapters,
and shared production form behavior for FormAdapter.

```sh
bun add @formadapter/react react react-dom zod
```

## Provider-first forms

Set one complete adapter for a subtree, then use the adapter-neutral
`createForm` everywhere below it:

```tsx
"use client";

import { FormAdapterProvider, createForm } from "@formadapter/react";
import { z } from "zod";
import { productAdapter } from "./product-adapter";

const Profile = createForm(z.object({
  name: z.string().min(2),
  email: z.email(),
}));

export function App() {
  return (
    <FormAdapterProvider adapter={productAdapter}>
      <Profile.Form onSubmit={(values) => console.log(values)} />
    </FormAdapterProvider>
  );
}
```

The nearest provider wins and a child provider replaces its parent adapter
wholesale. A complete form-local `adapter` prop has higher priority. As a third
fallback, `createFormFactory(adapter)` creates an adapter-bound factory for
isolated forms or adapter packages.

## Schema-bound namespace

`createForm(schema)` returns `Form`, `Field`, `Fields`, `Submit`, `Step`, `When`,
`Wizard`, and typed `useField`/`useFormState`/`useFormModel` hooks.
`configure(...)` rebinds the same schema with contextually typed field paths,
values, predicates, validators, options, and array labels. An adapter-bound
`createFormFactory(typedAdapter)` also limits custom control names to that
adapter's registry.

```tsx
const Signup = createForm(schema).configure({
  fields: {
    company: {
      hidden: (values) => values.kind !== "company",
      requiredWhenVisible: (values) => values.kind === "company",
    },
    role: {
      options: (values) => rolesFor(values.kind),
    },
    username: {
      asyncValidate: async (value, _values, { signal }) =>
        (await isAvailable(value, signal)) ? undefined : "Already taken",
    },
    teammates: {
      array: { addLabel: "Add teammate", itemLabel: "Teammate" },
    },
  },
});
```

- `When` conditionally renders composed React layouts.
- `Wizard` validates the active step before advancing, supports conditional
  steps, and routes client/server errors to the owning step.
- Dynamic options are static lists or synchronous functions of current values;
  a composed `Field` can also receive a resolved `options` list at render time.
- Async field validation is debounced and stale-safe through its abort signal.
- Homogeneous scalar/object arrays support add, remove, reorder, focus, labels,
  and schema minimum/maximum bounds.

Array item configuration uses templates such as `teammates[].email`. Runtime
hooks use concrete indices such as `useField("teammates.0.email")`; `Field` and
wizard steps own the parent array rather than an unindexed item template.

## Draft persistence

```tsx
<Signup.Form
  draft={{ key: "signup:v1", debounceMs: 500 }}
  onSubmit={saveSignup}
/>
```

Drafts default to `localStorage`. The package also exports
`sessionStorageDraftAdapter`, `createStorageDraftAdapter`, and a typed adapter
contract for custom sync or async persistence. `useFormState()` exposes values,
errors, validation/submission state, `draftStatus`, `clearDraft`, `reset`, and
`setValue`.

Advanced composed controls can inspect the compiled schema model from inside a
form with `Signup.useFormModel()`. It retains the signup schema's input type
and adapter-specific custom-control names. The unbound `useFormModel()` export
provides the same runtime model with schema-neutral types for reusable adapter
infrastructure. Both hooks must run beneath a mounted FormAdapter form.

## Submission contracts

An `onSubmit` handler receives transformed schema output plus a context with the
prepared schema input, schema-aware `FormData`, and an `AbortSignal`. It may
return a shared `SubmissionState` so business or transport errors render in the
same form.

Alternatively, pass a native React 19 `(previousState, FormData)` action through
the mutually exclusive `action` prop. The form integrates it with
`useActionState`, pending UI, structured result state, and server field errors.

Before either path, the runtime rebuilds model-owned `FormData` entries from
prepared form state. Dotted paths and explicit markers preserve nested arrays,
unchecked booleans, typed option values, disabled controls, and files while
leaving unrelated submitter/framework fields intact.

`hidden: true` removes a presentation branch and prunes its value before
validation/submission. `control: "hidden"` instead renders and submits a real
hidden input. Hidden inputs are user-controlled and are not a security boundary.

## Adapter contract

Use `createAdapter` to supply all built-in controls and every visible slot:
form, field, group, array, array item, button, wizard, message, error summary,
and unsupported diagnostic. Use `adapter.extend(...)` to create an intentional
partial variation before placing that complete adapter in a provider.

FormAdapter owns state and behavior; adapters own markup and styling. Custom
controls receive value callbacks, accessibility props, and `controlRef`, which
must be attached to their focusable element for invalid-field focus.
Button slots should forward the optional `ariaLabel`; the runtime uses it to
distinguish repeated array-item actions without changing their visible labels.
