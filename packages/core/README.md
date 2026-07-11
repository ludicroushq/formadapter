# `@formadapter/core`

Framework-free schema compilation, value preparation, validation helpers, and
submission state for FormAdapter.

```sh
bun add @formadapter/core zod
```

## Schema contract

A schema must expose both Standard Schema V1 validation and Standard JSON
Schema V1 input conversion. Zod 4 and ArkType 2 provide those interfaces
natively, so this package has no runtime dependency on either library.

```ts
import { compileForm, getDefaultValues, validate } from "@formadapter/core";
import { z } from "zod";

const schema = z.object({
  email: z.email(),
  seats: z.number().int().min(1),
});

const model = compileForm(schema);
const defaults = getDefaultValues(model);
const result = await validate(schema, { email: "ada@example.com", seats: 2 });
```

FormAdapter reads only the schema's input-side JSON Schema for rendering, then
delegates validation and transformation back to the original schema. Input and
output types may therefore differ without losing type safety.

`compileForm(schema, config)` normalizes objects, scalar/object arrays,
constraints, formats, options, defaults, references, `allOf`, nullable values,
and discriminated object unions into a renderer-neutral model. Configuration
can add presentation rules, dynamic options, async field validators, array
labels, and custom control names without changing the schema.

## Prepared values and presentation rules

`prepareFormValues(model, values)` applies browser-to-schema absence semantics:
optional blanks become absent, nullable blanks become `null`, empty optional
objects disappear, and fields hidden by presentation predicates are pruned.
`validatePresentationRules` enforces `requiredWhenVisible` independently of the
schema. Use both at a server trust boundary when presentation rules matter.

## Submission state

`SubmissionState<Data>` is the serializable contract shared by the React,
server, Next.js, TanStack Start, oRPC, and HTTP packages. Use
`submissionSuccess`, `submissionFailure`, `initialSubmissionState`, and
`isSubmissionState` when writing a custom transport.

The package also exports typed path helpers, option serialization, issue/error
normalization, schema input/output inference, default construction, and the
canonical `isReservedFormPathSegment` guard for custom transports.

## Boundaries

Tuples, dynamic record keys, general structural unions, circular references,
and discriminated object unions inside arrays compile to explicit unsupported
nodes. Renderers can show those nodes through their own diagnostic slot instead
of silently dropping schema structure. Multiple file selection must use an
array-of-files schema; `multiple: true` is rejected on a scalar file field.

Property names must also be losslessly encodable as form paths. Empty,
numeric-like, transport-reserved, `root`, or prototype-reserved names and names that
contain `.`, `[`, `]`, `'`, or `"` compile to an unsupported node instead of
binding to the wrong value.
