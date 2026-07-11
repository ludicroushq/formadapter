# `@formadapter/server`

Framework-neutral schema-aware FormData/JSON validation and reusable submission
transports for FormAdapter.

```sh
bun add @formadapter/server
```

The package compiles a schema's input-side Standard JSON Schema once and
delegates authoritative validation/transformation to the original Standard
Schema. FormData is decoded from model-known paths and normalized for browser
semantics first. JSON is passed to the schema exactly as received: unknown
keys, malformed nested values, and other invalid input are never pruned before
validation. Zod, ArkType, and any other schema exposing both standards use the
same boundary.

## Reusable submissions

Build one transport-neutral submission, then expose it through any boundary:

```ts
import { z } from "zod";
import {
  createSubmissionHandler,
  fieldError,
  toRequestHandler,
  toServerAction,
} from "@formadapter/server";

const schema = z.object({
  email: z.email(),
  age: z.number().int().min(18),
});

const submission = createSubmissionHandler(schema, async (values) => {
  if (await emailAlreadyExists(values.email)) {
    throw fieldError("email", "That email is already registered");
  }
  return database.users.create({ data: values });
});

export const action = toServerAction(submission);
export const POST = toRequestHandler(submission);
```

`createServerAction(schema, handler)` and
`createRequestHandler(schema, handler)` are direct convenience factories. A
server action has React's native `(previousState, FormData)` signature. The HTTP
handler accepts POST requests with JSON, `multipart/form-data`, or
`application/x-www-form-urlencoded` bodies and returns serialized
`SubmissionState` JSON.

Pass the same `config` used to create the client form when server parsing must
apply `requiredWhenVisible` rules. Model-decoded FormData also prunes conditional
`hidden` branches. JSON stays exactly as received so strict-object and malformed
payload errors cannot disappear before schema validation:

```ts
const submission = createSubmissionHandler(schema, save, { config: formConfig });
```

Expected business failures should be thrown with `formError`, `fieldError`, or
`FormAdapterServerError`. They become structured field/form errors. Unexpected
errors are deliberately rethrown so framework error boundaries, monitoring,
redirects, and not-found control flow are not swallowed.

Transport adapters may add context to the submission's second argument. For
example, the TanStack Start adapter preserves its middleware `context`, method,
and server-function metadata for the business handler. Adapter-owned
`payloadKind` and `formData` values cannot be overridden by transport input.

Use `createSubmissionHandlerFactory<InvocationContext>()` to bind a transport
context once while retaining schema-output and handler-result inference. Its
returned submissions require the context argument; the default
`createSubmissionHandler` remains optional-context and backward compatible.

## Typed FormData decoding

The React runtime uses dotted paths for objects and array indices. Three
repeatable hidden markers preserve information native FormData normally loses:

- `__formadapter_array` records a concrete array path, including an empty array.
- `__formadapter_boolean` records a boolean path, including an unchecked value.
- `__formadapter_value` opts a concrete scalar path into tagged string, number,
  boolean, or null decoding.

The exported constants are available for custom renderers. `parseFormData`
ignores framework `$ACTION_` entries and unknown fields, protects unsafe object
path segments and oversized indices, preserves files, normalizes optional and
nullable blanks, and prunes presentation-hidden branches before validation.

FormData parsing throws a descriptive configuration error for schema paths it
cannot encode: FormAdapter's `__formadapter_` namespace, `$ACTION_` names,
prototype keys, numeric-like keys, and keys containing path syntax such as dots,
brackets, or quotes. JSON-only server submissions can still validate those
properties, but FormAdapter cannot render or encode them as form fields.

Do not treat hidden inputs as trusted data. Authentication, authorization, and
ownership checks remain the responsibility of every server handler.
