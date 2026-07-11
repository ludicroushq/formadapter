# Examples

Bare-bones Next.js App Router examples rendered with the DaisyUI adapter:

- `/zod`
- `/arktype`
- `/arrays-files`
- `/next-server-action`

The index contains only links. Each example page renders only an `h1` and its
form, with no presentation styles beyond DaisyUI itself.

```sh
# from the repository root
bun install
bun run dev:example
```

This builds the workspace packages once before starting their watchers and the
example app, so it also works immediately after a clean clone.
