# FormAdapter docs

The documentation site is a Next.js 16 application built with Fumadocs. It
contains the product landing page, human guides, built-in search, per-page raw
Markdown, `/llms.txt`, and `/llms-full.txt`.

```sh
bun run dev:docs
```

The site runs on `http://localhost:3000`; Turbo builds its workspace
dependencies first. Vercel deployment URLs are detected automatically. On
other hosts, set `NEXT_PUBLIC_SITE_URL` to the deployed origin so canonical,
sitemap, and Open Graph URLs are correct.

Documentation content lives in `content/docs`; navigation order is controlled
by the adjacent `meta.json` files.
