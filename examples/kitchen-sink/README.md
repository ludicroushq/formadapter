# Examples

Bare-bones Next.js App Router examples rendered with FormAdapter's UI adapters:

- `/zod`
- `/arktype`
- `/html`
- `/shadcn` (Base UI)
- `/shadcn-radix` (Radix UI)
- `/arrays-files`
- `/next-server-action`

The index contains only links. Each example page renders only an `h1` and its
form, with no presentation styles beyond the selected adapter. The shadcn/ui
routes pass locally generated components to the matching Base UI or Radix
connector.

```sh
# from the repository root
bun install
bun run dev:example
```

This builds the workspace packages once before starting their watchers and the
example app, so it also works immediately after a clean clone.
