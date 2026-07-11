# `@formadapter/nextjs`

Next.js-focused aliases for FormAdapter's native React 19 Server Action
integration.

```sh
bun add @formadapter/nextjs
```

## Create an action

```ts
// app/profile/actions.ts
"use server";

import { createNextAction, fieldError } from "@formadapter/nextjs";

export const saveProfile = createNextAction(profileSchema, async (profile) => {
  if (await emailAlreadyExists(profile.email)) {
    throw fieldError("email", "That email is already registered");
  }
  return { id: await save(profile) };
});
```

```tsx
<Profile.Form action={saveProfile} />
```

The action accepts `(previousState, FormData)` and returns the shared,
serializable `SubmissionState`. FormAdapter's React runtime wires that contract
through `useActionState`, shows pending state, and applies server field/form
errors. Successful action data remains typed through `onResult` and
`initialSubmissionState`.

`createNextAction` is an alias of `createServerAction` from
`@formadapter/server`. This package also re-exports `createSubmissionHandler`,
`toServerAction`, `parseFormData`, `formError`, `fieldError`, and
`FormAdapterServerError` for a Next-focused import path.

When the client form uses conditional `hidden` or `requiredWhenVisible`
configuration, pass the same config as the third argument so the server trust
boundary enforces identical presentation rules:

```ts
export const saveProfile = createNextAction(profileSchema, save, {
  config: profileConfig,
});
```

The decoder restores nested arrays, booleans, typed options, nullable/optional
values, and files from the FormAdapter FormData codec before running the
original schema. Authentication, authorization, and ownership checks still
belong inside every action; browser inputs and hidden controls are untrusted.
