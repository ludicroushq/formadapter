# FormAdapter

Schema-native React forms that render through your design system.

[![CI](https://github.com/ludicroushq/formadapter/actions/workflows/ci.yml/badge.svg)](https://github.com/ludicroushq/formadapter/actions/workflows/ci.yml)

FormAdapter turns a schema into a renderer-neutral form model, keeps the schema
authoritative for validation and transforms, and delegates every visible control
and layout primitive to a UI adapter.

Zod 4 and ArkType 2 work without vendor adapters because both expose
[Standard Schema](https://standardschema.dev/) validation and
[Standard JSON Schema](https://standardschema.dev/json-schema) input conversion.
FormAdapter reads structure from the input JSON Schema and sends collected values
back through the original schema, so refinements and input-to-output transforms
remain intact. It does not use OpenAPI as an intermediate format.

## Quick start

Install the React runtime, DaisyUI adapter, your schema library, and DaisyUI:

```sh
bun add @formadapter/react @formadapter/daisyui zod daisyui
```

Set the adapter once near the root of your client tree. `DaisyUIProvider` is a
small client boundary, so it is safe to render from a Next.js layout without
passing the function-rich adapter through Server Component props.

```tsx
// app/providers.tsx
"use client";

import { DaisyUIProvider } from "@formadapter/daisyui";

export function Providers({ children }: { children: React.ReactNode }) {
  return <DaisyUIProvider>{children}</DaisyUIProvider>;
}
```

Forms created with the adapter-neutral `createForm` now resolve DaisyUI from the
provider. After that setup, the schema is almost the entire form:

```tsx
"use client";

import { createForm } from "@formadapter/react";
import { z } from "zod";

const Contact = createForm(z.object({
  name: z.string().min(2),
  email: z.email(),
  message: z.string().min(10),
  updates: z.boolean().default(true),
})).configure({
  fields: {
    name: { label: "Full name" },
    message: { control: "textarea" },
    updates: { label: "Send me product updates" },
  },
});

export function ContactForm() {
  return <Contact.Form onSubmit={(values) => console.log(values)} />;
}
```

`values` is the schema output type. The submission context separately exposes
the prepared schema input, typed `FormData`, and an `AbortSignal` for transport
work. `configure` keeps paths, predicate values, and validator values
contextually typed. Use `createFormFactory(aTypedAdapter)` when form
configuration should also be restricted to that adapter's exact custom-control
names.

For a composed layout, use the same schema-bound namespace:

```tsx
<Contact.Form onSubmit={saveContact}>
  <div className="grid gap-4 md:grid-cols-2">
    <Contact.Field name="name" />
    <Contact.Field name="email" />
  </div>
  <Contact.Field name="message" />
  <Contact.Submit>Send message</Contact.Submit>
</Contact.Form>
```

## Adapter scopes

Adapter resolution is deterministic:

1. A complete `adapter` passed to one form.
2. The nearest `FormAdapterProvider`.
3. The adapter bound by an adapter-specific factory such as
   `@formadapter/html`, `@formadapter/daisyui`, or the `createForm` returned by
   `createShadcn(...)`.

A child provider replaces its parent adapter for that subtree; adapters are
never implicitly merged across scopes. Build an intentional partial variation
first with `adapter.extend(...)`, then provide the resulting complete adapter:

```tsx
import { daisyUIAdapter } from "@formadapter/daisyui";
import { FormAdapterProvider } from "@formadapter/react";

const productAdapter = daisyUIAdapter.extend({
  name: "Product UI",
  slots: { Button: ProductButton },
  controls: { custom: { "product:rating": RatingControl } },
});

<FormAdapterProvider adapter={productAdapter}>
  <ProductForm />
</FormAdapterProvider>
```

Start custom design systems from `htmlAdapter.extend(...)`; it provides every
accessible native primitive without imposing styles. Use `createAdapter` only
when every primitive truly needs replacement. Adapters own controls plus the
form, field, group, array, array-item,
button, wizard, message, error-summary, and unsupported-field slots. The shared
runtime owns traversal, state, accessibility wiring, validation, conditional
behavior, drafts, and array operations.

`createFormFactory(productAdapter)` creates an adapter-bound form factory and
preserves the exact names registered in `controls.custom` during configuration.

Custom controls receive value-oriented callbacks and a `controlRef`. Attach that
ref to the focusable element so invalid submissions and wizard error routing can
focus it. Custom button slots should also forward the optional `ariaLabel`,
which gives repeated array-item actions item-specific accessible names.

## Common form features

### Conditional fields and requiredness

Field presentation can be a boolean or a typed predicate. Pair `hidden` with
`requiredWhenVisible` when a schema-optional value becomes required in one UI
branch:

```tsx
const Account = createForm(z.object({
  kind: z.enum(["personal", "company"]),
  company: z.string().optional(),
})).configure({
  fields: {
    company: {
      hidden: (values) => values.kind !== "company",
      requiredWhenVisible: (values) => values.kind === "company",
      requiredMessage: "Enter a company name",
    },
  },
});
```

`disabled` and `readOnly` accept the same form-wide predicates. In composed
layouts, `Account.When` conditionally renders arbitrary React content:

```tsx
<Account.When field="kind" equals="company">
  <Account.Field name="company" />
</Account.When>
```

Discriminated object unions are normalized into the same conditional behavior:
choosing the discriminator reveals and requires only the active branch.

There are two intentionally different kinds of hidden field:

- `hidden: true` or a true `hidden` predicate means “not part of this active UI
  branch.” The field is not rendered, stale values are pruned before validation,
  and it is omitted from submission.
- `control: "hidden"` renders a real hidden input. Its value remains in form
  state, is schema-validated, and is submitted. Like every browser value, it is
  user-editable and must not be trusted for authorization or other secrets.

### Wizards

`Wizard` uses typed field paths, validates only the current step before moving
forward, supports conditional steps, can collect unassigned fields into a final
step, and routes client or server field errors back to their owning step:

```tsx
<Account.Wizard
  action={saveAccount}
  includeRemaining={false}
>
  <Account.Step title="Account">
    <Account.Field name="kind" />
  </Account.Step>
  <Account.Step
    id="company"
    title="Company"
    when={(values) => values.kind === "company"}
  >
    <Account.Field name="company" />
  </Account.Step>
</Account.Wizard>
```

Steps infer ownership from their `Field`, `Fields`, and `When` descendants
through fragments and native markup. Use a step's `fields` prop to add paths
rendered inside an opaque custom component; use `fields={[]}` for a content-only step. By default,
unassigned fields are collected into a final step, so set
`includeRemaining={false}` only when every field is assigned deliberately.
Opaque paths validate whenever their step is active, so keep conditional
`When` branches in native markup or field configuration.
Give dynamically inserted, removed, or reordered steps an `id` or stable React
`key` so the active step keeps its identity.

### Dynamic options and async validation

Options can be static or a synchronous projection of current form/application
state. Query-backed options may also be supplied to a composed `Field` at
render time. String, number, boolean, and null option values retain their types.

```tsx
const Signup = createForm(schema).configure({
  fields: {
    plan: {
      options: (values) => plansFor(values.accountType),
    },
    username: {
      asyncValidationDebounceMs: 300,
      asyncValidate: async (value, _values, { signal }) => {
        const available = await checkUsername(value, { signal });
        return available ? undefined : "That username is unavailable";
      },
    },
  },
});
```

Async field validators run after authoritative schema validation, are debounced,
and receive a signal that aborts when a newer validation supersedes them. They
may return one message, multiple messages, or `undefined`.

### Drafts

Passing a draft key enables debounced `localStorage` persistence. Drafts load
before the form becomes interactive and clear after a successful submission by
default:

```tsx
<Signup.Form
  draft={{ key: "signup:v1", debounceMs: 500 }}
  onSubmit={saveSignup}
/>
```

Use `sessionStorageDraftAdapter`, or provide a custom sync/async adapter with
`load`, `save`, and `clear` methods for IndexedDB or a server-backed draft.
`useFormState()` exposes `draftStatus` and `clearDraft()`.

### Homogeneous arrays

Scalar and object arrays support add, remove, reorder, focus management, custom
action/item labels, and schema `minItems`/`maxItems` bounds. Required minimum
items are seeded into defaults, and actions cannot move outside those bounds.
Array item configuration uses typed paths such as `collaborators[].email`.

## Server submissions

All transports use the shared serializable `SubmissionState` union: `idle`,
`success`, or `error` with form/field errors and an error kind. Schema failures,
business failures, and transport failures therefore render consistently.

### Next.js Server Actions

```ts
// app/profile/actions.ts
"use server";

import { createNextAction, fieldError } from "@formadapter/nextjs";

export const saveProfile = createNextAction(profileSchema, async (profile) => {
  if (await emailExists(profile.email)) {
    throw fieldError("email", "That email is already registered");
  }
  return database.profile.create({ data: profile });
});
```

```tsx
<Profile.Form action={saveProfile} />
```

This is the native React 19 `(previousState, FormData)` contract and is wired
through `useActionState`, including pending state and server error placement.
Pass the same presentation config to `createNextAction` when server parsing must
enforce `requiredWhenVisible` or conditional pruning.

### TanStack Start server functions

```ts
const submission = createSubmissionHandler(profileSchema, saveProfile);

export const saveProfileFn = createServerFn({ method: "POST" })
  .validator(formDataValidator)
  .handler(tanstackStartHandler(submission));
```

```tsx
const onSubmit = useTanStackStartSubmission(saveProfileFn);
return <Profile.Form onSubmit={onSubmit} />;
```

Import `formDataValidator` and `tanstackStartHandler` from
`@formadapter/tanstack-start/server`; import the hook from the package root or
`/client`. The hook uses TanStack Start's redirect-aware `useServerFn`, forwards
the abort signal, and preserves `.url` metadata for applications that also
build a raw progressive-enhancement path.

### oRPC

```tsx
<Profile.Form onSubmit={createORPCSubmission(orpc.profile.update)} />
```

The oRPC adapter sends the schema input by default, forwards the abort signal
and caller context/options, and maps `FORM_SUBMISSION_FAILED` plus `BAD_REQUEST`
issues into field errors. `createORPCActionSubmission` supports `.actionable()`
tuples. Use `mapInput` only when procedure and form wire shapes differ.

### Regular HTTP

```tsx
const submit = createHttpSubmission({ url: "/api/profile" });
<Profile.Form onSubmit={submit} />;
```

JSON is the default and sends prepared schema input. Set `body: "form-data"`
for file uploads or an existing multipart endpoint. On the server,
`createRequestHandler` or `toRequestHandler` accepts JSON, multipart, and URL-
encoded POST requests.

## Typed FormData codec

Native `FormData` loses unchecked booleans, empty arrays, non-string option
types, and disabled controls. Before an enhanced submission, the React runtime
rebuilds every model-owned entry from prepared form state while preserving
unrelated submitter/framework entries. It emits dotted object/array paths and
explicit markers for arrays, booleans, and typed values.

`@formadapter/server` decodes those entries against the compiled schema model,
accepts only known paths, restores primitive option types, preserves files and
empty collections, rejects unsafe path segments, prunes inactive branches, and
then runs the original Standard Schema. The same codec powers Next Server
Actions and TanStack Start. Native hidden mirrors also preserve supported values
for ordinary browser submission where possible.

## Packages

| Package | Responsibility |
| --- | --- |
| `@formadapter/core` | Framework-free compilation, form model, paths, defaults, value preparation, presentation validation, and submission state |
| `@formadapter/react` | Typed React state, schema-bound components/hooks, provider scopes, renderer, drafts, wizards, and adapter contract |
| `@formadapter/html` | Accessible, unstyled native HTML adapter and custom-design-system foundation |
| `@formadapter/daisyui` | Complete DaisyUI 5 adapter using accessible native HTML controls |
| `@formadapter/shadcn` | Typed Base UI and Radix connectors for source-owned shadcn/ui components |
| `@formadapter/server` | Schema-aware FormData/JSON validation, business errors, reusable submissions, Server Actions, and Request handlers |
| `@formadapter/nextjs` | Next.js-focused aliases for native React Server Actions |
| `@formadapter/tanstack-start` | TanStack Start client hook and server-function boundary helpers |
| `@formadapter/orpc` | Typed oRPC procedure and actionable-procedure submissions/error mapping |
| `@formadapter/http` | Fetch-based JSON or multipart submissions for regular HTTP endpoints |

The core dependency direction remains one-way:

```text
schema -> @formadapter/core model -> @formadapter/react runtime -> adapter UI
```

Transport integrations consume the same prepared input and `SubmissionState`
without coupling the compiler to a framework.

## Native HTML setup

For browser-native controls with no design-system styles, import the bound
factory directly:

```tsx
import { createForm } from "@formadapter/html";

const Contact = createForm(contactSchema);
```

The package also exports `HTMLProvider` and `htmlAdapter`. Extend
`htmlAdapter` to build a design-system adapter from complete accessible
defaults instead of reimplementing the contract.

## DaisyUI setup

Include the adapter build in Tailwind's source scan:

```css
@import "tailwindcss";
@source "../node_modules/@formadapter/daisyui/dist";
@plugin "daisyui";
```

The adapter uses plain HTML elements and DaisyUI classes; it does not add a
React component-wrapper dependency. The package also exports an adapter-bound
`createForm` for isolated forms that do not use a provider.

## shadcn/ui setup

Generate the components FormAdapter needs, then pass those exact components to
the connector for your shadcn primitive library:

```sh
bun add @formadapter/react @formadapter/shadcn zod
bunx shadcn@latest add alert button checkbox field input native-select progress radio-group spinner textarea
```

```tsx
import { createShadcn } from "@formadapter/shadcn/baseui";
// Radix UI: import { createShadcn } from "@formadapter/shadcn/radix";
import { components } from "./shadcn-components";

export const shadcn = createShadcn(components);
export const ShadcnProvider = shadcn.Provider;
```

The component bundle contains the generated Alert, Button, Checkbox, Field,
Input, Native Select, Progress, Radio Group, Spinner, and Textarea exports. The
returned setup provides `Provider`, `adapter`, and an adapter-bound `createForm`.
There is no FormAdapter CSS import: your generated component source and
existing theme remain the styling source.

## Current boundaries

Automatic layout expects an object at the schema root. Nested objects,
homogeneous scalar/object arrays, nullable primitives, enums/literals,
references, `allOf` compositions, and discriminated object unions are
supported.

Tuples, dynamic record keys, general structural unions, recursive/circular
references, and discriminated object unions inside arrays render an explicit
adapter-owned unsupported diagnostic instead of silently producing an
incomplete form. Options are a finite synchronous list; fetch them outside the
form configuration and pass the resolved list when data is async.

Multiple-file values must be modeled as a homogeneous array of files. Setting
`multiple: true` on a scalar file field produces an explicit unsupported node,
because accepting an array in the UI for a scalar schema would make client and
server validation disagree.

`defaultValues` is mount-time state, matching native form and React Hook Form
semantics. To load another record into a mounted form, call
`useFormState().reset(nextValues)` from inside the bound form or remount with a
new React `key`.

## Examples

The [Next.js examples](./examples/kitchen-sink) are intentionally bare-bones.
The index is only a list, and every example route contains one heading and one
form so the source stays easy to copy. The examples cover Zod, ArkType, arrays,
files, native HTML, DaisyUI, shadcn/ui, the provider-first API, a wizard with
draft and async validation, and a native Next.js Server Action.

```sh
bun install
bun run dev:example
```

The root `bun run dev` command starts the packages and documentation site, not
the examples. `dev:example` builds the example's workspace dependencies once,
then watches those packages alongside the example app.

## Documentation site

The Fumadocs site in [`docs`](./docs) contains the product landing page,
task-focused guides, built-in search, per-page Markdown, and LLM indexes.

```sh
bun run dev:docs
```

## Development

```sh
bun run lint
bun run typecheck
bun run build
bun run test:coverage
# or all four
bun run check
```

The repository uses Bun workspaces, Turborepo, tsdown, Vitest, Oxlint, and
Changesets. Builds are checked with publint and Are The Types Wrong. Coverage
targets meaningful behavior rather than tests written only to inflate a number.

Packages currently start at `0.0.0`; published versions are managed through
Changesets and the release workflow.

## License

MIT
