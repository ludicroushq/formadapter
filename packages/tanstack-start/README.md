# `@formadapter/tanstack-start`

TanStack Start server-function integration for FormAdapter. It connects a
FormAdapter `onSubmit` callback to a POST server function while keeping parsing,
schema validation, and structured submission errors in `@formadapter/server`.

```sh
bun add @formadapter/tanstack-start @formadapter/server @tanstack/react-start
```

## Server function

Build the reusable submission first, then place the thin TanStack Start boundary
around it:

```ts
import { createServerFn } from "@tanstack/react-start";
import { createSubmissionHandler } from "@formadapter/server";
import {
  formDataValidator,
  tanstackStartHandler,
} from "@formadapter/tanstack-start/server";
import { profileSchema } from "./profile-schema";

const submission = createSubmissionHandler(
  profileSchema,
  async (profile) => database.profile.save(profile),
  { config: profileConfig },
);

export const saveProfile = createServerFn({ method: "POST" })
  .validator(formDataValidator)
  .handler(tanstackStartHandler(submission));
```

`formDataValidator` only verifies the transport shape. The reusable submission
performs authoritative schema and presentation-rule validation so failures come
back as FormAdapter's shared `SubmissionState` instead of escaping TanStack
Start's validator as generic errors. Pass the same form config when conditional
`hidden` or `requiredWhenVisible` rules must also be enforced on the server.

TanStack's handler context is forwarded into the submission context. Middleware
auth data is available as `context.context`; `method` and `serverFnMeta` are
preserved too. Treat that data as request context, and still perform
authorization in the business handler.

Use `createSubmissionHandlerFactory<TanStackStartSubmissionContext<AuthContext>>()`
when the business callback needs that middleware context inferred. The returned
context-bound submission requires its invocation context, and
`tanstackStartHandler` always supplies it.

## Client form

Use the hook in the client component that renders the form:

```tsx
"use client";

import { useTanStackStartSubmission } from "@formadapter/tanstack-start";
import { Profile } from "./profile-form";
import { saveProfile } from "./profile.functions";

export function ProfileEditor() {
  const onSubmit = useTanStackStartSubmission(saveProfile);
  return <Profile.Form onSubmit={onSubmit} />;
}
```

The hook calls TanStack Start's redirect-aware `useServerFn`, sends the form's
schema-aware `context.formData`, forwards its `AbortSignal`, and returns the
server's shared submission state. Options can supply static/dynamic headers, a
custom fetch implementation, or an alternate `FormData` value. GET server
functions are rejected because submissions require POST.

`UseTanStackStartSubmissionOptions<Values, Input>` types the `headers` and
`getFormData` customization callbacks without changing server-result inference.

Client and server exports are intentionally separate. The package root and
`/client` contain the hook; `/server` contains only the validator and handler
adapter, so server integration code cannot leak into the client entry.

## Progressive enhancement

TanStack Start exposes a server function's `.url` for raw HTML form actions.
`useTanStackStartSubmission` copies that URL from the original server function
onto the returned handler and exposes `{ url, method, encType }` as `metadata`.
TanStack's `useServerFn` callback itself does not retain this property.

The hook remains a JavaScript-enhanced submission path. Posting a raw HTML form
to `.url` can provide no-JavaScript transport, but FormAdapter's client-side
state mapping and inline structured errors do not run in that mode. Applications
that require full progressive enhancement should design the raw response and
redirect/error experience explicitly instead of assuming hook behavior applies.
