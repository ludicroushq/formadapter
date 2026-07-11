# `@formadapter/orpc`

Connect a FormAdapter form to an oRPC procedure without coupling the form to a
router, transport, or UI adapter.

```sh
bun add @formadapter/orpc @orpc/client
```

## Client procedures

`createORPCSubmission` returns a FormAdapter `onSubmit` handler. It sends the
schema input from `SubmitContext` by default, not the transformed output passed
as the first argument. That lets the server run the schema's transforms again
at its trust boundary. The form's abort signal is forwarded through oRPC caller
options.

```tsx
import { createORPCSubmission } from "@formadapter/orpc";

<Account.Form onSubmit={createORPCSubmission(orpc.account.update)} />;
```

The procedure output is wrapped as `{ status: "success", data }`. A procedure
that already returns a well-formed FormAdapter `SubmissionState` passes through
unchanged.

Use `mapInput` only when the form and procedure intentionally have different
wire shapes. Caller options and oRPC context can be static values or per-submit
factories:

```ts
const submit = createORPCSubmission(orpc.account.update, {
  mapInput: (values) => ({ account: values }),
  context: (_values, context) => ({ requestId: context.formData.get("requestId") }),
  options: () => ({ lastEventId: currentEventId }),
});
```

Unknown thrown values and server-side failures receive a safe generic message.
Use `mapError` for application-specific errors; returning `undefined` falls
through to the built-in mappings.

## Typed form errors

The package has no `@orpc/server` dependency. It exports a structural Standard
Schema error declaration that can be installed once on an oRPC base builder:

```ts
import { FORM_SUBMISSION_ERROR_MAP } from "@formadapter/orpc";
import { os } from "@orpc/server";

const formProcedure = os.errors(FORM_SUBMISSION_ERROR_MAP);
```

In a handler, return the error through oRPC's generated constructor:

```ts
throw errors.FORM_SUBMISSION_FAILED({
  data: submissionFailure({
    fieldErrors: { email: ["That address is already registered."] },
  }),
});
```

`createORPCSubmission` maps that data directly into form state. It also maps
oRPC's built-in `BAD_REQUEST` `{ issues }` payload, preserving nested and array
Standard Schema paths.

That `BAD_REQUEST` mapping is runtime fallback behavior, not a declared custom
error. It works with oRPC's default input-validation payload. If an interceptor
replaces or removes `data.issues`, use a typed custom error or `mapError` instead.

## Actionable procedures

Use `createORPCActionSubmission` for the tuple returned by `.actionable()`.
This is separate because actionable procedures return JSON errors instead of
throwing ordinary `ORPCError` instances and cannot accept an AbortSignal.
Unexpected throws are deliberately re-thrown so framework redirects and
not-found control flow continue to work.

`@orpc/react`'s `createFormAction` is a different integration: it consumes
bracket-notation `FormData` and returns no result state. FormAdapter uses its
typed object submission path here so errors can be applied to the form.
