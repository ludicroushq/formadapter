import { Braces, Layers, Workflow } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { HeroExample } from "@/components/hero-example";
import { InstallCommand } from "@/components/install-command";
import { ServerErrorDemo } from "@/components/server-error-demo";
import { highlightHomepageCode } from "@/lib/highlight";
import { examplesUrl, repositoryUrl } from "@/lib/shared";

const schemaExample = `const signupSchema = z.object({
  email: z.email(),
  accountType: z.enum(["personal", "company"]),
  company: z.string().min(2).optional(),
});

const Signup = createForm(signupSchema).configure({
  fields: {
    accountType: { control: "radio" },
    company: {
      hidden: (values) => values.accountType !== "company",
      requiredWhenVisible: (values) =>
        values.accountType === "company",
    },
  },
});`;

const providerExample = `"use client";

import type { ReactNode } from "react";
import { DaisyUIProvider } from "@formadapter/daisyui";

export function Providers({ children }: { children: ReactNode }) {
  return <DaisyUIProvider>{children}</DaisyUIProvider>;
}`;

const serverExample = `"use server";

import { createNextAction, fieldError } from "@formadapter/nextjs";

export const saveProfile = createNextAction(
  profileSchema,
  async (profile) => {
    if (await emailExists(profile.email)) {
      throw fieldError("email", "Already registered");
    }

    return save(profile);
  },
);`;

export default async function HomePage(): Promise<React.JSX.Element> {
  const [schemaCode, providerCode, serverCode] = await Promise.all([
    highlightHomepageCode(schemaExample),
    highlightHomepageCode(providerExample),
    highlightHomepageCode(serverExample),
  ]);

  return (
    <div className="landing-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="landing-header">
        <div className="landing-container landing-nav">
          <Link aria-label="FormAdapter home" href="/">
            <Brand />
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/docs">Docs</Link>
            <a href={repositoryUrl}>GitHub</a>
          </nav>
          <Link className="nav-cta" href="/docs/getting-started">
            Get started
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-hero">
          <div className="landing-container hero-grid">
            <div className="hero-copy">
              <p className="hero-eyebrow">
                <span aria-hidden="true" /> Open source · Zod &amp; ArkType
              </p>
              <h1>Build typed forms from the schemas you already have.</h1>
              <p className="hero-lede">
                FormAdapter turns your schema into a React form, keeps the
                original validation authoritative, and renders through DaisyUI
                or your own design system.
              </p>
              <div className="hero-actions">
                <Link className="button-primary" href="/docs/getting-started">
                  Get started <span aria-hidden="true">→</span>
                </Link>
                <a className="button-secondary" href={examplesUrl}>
                  View examples
                </a>
              </div>
              <InstallCommand />
              <p className="hero-note">
                React 19 · DaisyUI 5 · Next.js and TanStack Start · MIT licensed
              </p>
            </div>

            <HeroExample
              providerCode={providerCode}
              schemaCode={schemaCode}
            />
          </div>
        </section>

        <section aria-label="How FormAdapter works" className="workflow-strip">
          <ol className="landing-container workflow-items">
            <li>
              <span>01</span>
              <div>
                <strong>Define</strong>
                <small>Zod or ArkType</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Customize</strong>
                <small>Labels and widgets</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Render</strong>
                <small>DaisyUI or yours</small>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <strong>Submit</strong>
                <small>Fully typed values</small>
              </div>
            </li>
          </ol>
        </section>

        <section className="benefits-section">
          <div className="landing-container">
            <div className="section-heading">
              <p>One schema, the whole form</p>
              <h2>Less form code without losing control.</h2>
              <span>
                FormAdapter handles the repetitive runtime work and leaves the
                data contract and interface in your hands.
              </span>
            </div>

            <div className="benefit-grid">
              <article>
                <span className="benefit-icon"><Braces aria-hidden="true" /></span>
                <h3>The schema stays authoritative</h3>
                <p>
                  Constraints, refinements, defaults, and transforms remain in
                  Zod or ArkType instead of being copied into form code.
                </p>
                <Link href="/docs/reference/schema-support">Schema support →</Link>
              </article>
              <article>
                <span className="benefit-icon"><Layers aria-hidden="true" /></span>
                <h3>Set the UI once</h3>
                <p>
                  Mount a DaisyUI provider at the root, extend it, or replace it
                  with a complete adapter for your own design system.
                </p>
                <Link href="/docs/ui/adapters">Adapter scopes →</Link>
              </article>
              <article>
                <span className="benefit-icon"><Workflow aria-hidden="true" /></span>
                <h3>Hard form behavior is included</h3>
                <p>
                  Conditional fields, wizards, drafts, async checks, arrays,
                  files, focus management, and server errors share one runtime.
                </p>
                <Link href="/docs/forms/behavior">Form behavior →</Link>
              </article>
            </div>
          </div>
        </section>

        <section className="server-section">
          <div className="landing-container">
            <div className="server-heading">
              <p>Server errors</p>
              <h2>Errors return to the field that owns them.</h2>
              <span>
                The same result shape works with Next.js, TanStack Start, oRPC,
                and regular HTTP.
              </span>
              <Link href="/docs/server/submissions">Explore server integrations →</Link>
            </div>
            <div className="server-card">
              <ServerErrorDemo />
              <div className="server-code">
                <div>
                  <span>actions.ts</span>
                  <span>Server Action</span>
                </div>
                {serverCode}
              </div>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="landing-container final-cta-inner">
            <div>
              <h2>Bring a schema. Ship the form.</h2>
              <p>Start with DaisyUI today. Replace the UI when you need to.</p>
            </div>
            <div>
              <Link className="button-primary" href="/docs/getting-started">
                Read the setup <span aria-hidden="true">→</span>
              </Link>
              <a className="button-secondary" href={repositoryUrl}>View on GitHub</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container footer-inner">
          <Brand />
          <p>Schema-native React forms. MIT licensed and built in the open.</p>
          <nav aria-label="Footer navigation">
            <Link href="/docs">Docs</Link>
            <a href={examplesUrl}>Examples</a>
            <a href={repositoryUrl}>GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
