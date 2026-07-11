# `@formadapter/http`

Use any JSON or multipart HTTP endpoint as a FormAdapter submission target.

```sh
bun add @formadapter/http
```

```tsx
import { createHttpSubmission } from "@formadapter/http";

const submit = createHttpSubmission({ url: "/api/profile" });

<Profile.Form onSubmit={submit} />;
```

JSON is the default. It sends `SubmitContext.input`, the prepared schema input
before output transforms, so the server can validate and transform again at its
trust boundary. The endpoint response is wrapped as a successful shared
`SubmissionState` unless it already returns a well-formed state.

For files or an existing multipart endpoint, send the schema-aware FormData
created by the React runtime:

```tsx
const submit = createHttpSubmission({
  url: "/api/profile",
  body: "form-data",
  init: { credentials: "include" },
});
```

Do not manually set `content-type` in FormData mode; `fetch` must add its
boundary. `init` may also be a per-submit function and can set method/headers.
The submit AbortSignal is always forwarded, and a custom `fetch` implementation
is supported.

Structured error states from successful and 4xx responses are preserved. A 4xx
string or `message` is treated as intentional client-safe feedback. Response
bodies from 5xx failures and exception messages from network failures are never
shown to users; they use `errorMessage` or a safe fallback instead. Aborts are
re-thrown so cancellation keeps working. A failed HTTP status is never treated
as success merely because its body resembles a successful state.
