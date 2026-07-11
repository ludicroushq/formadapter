"use client";

import {
  useState,
  type ReactNode,
} from "react";

import {
  LandingDemo,
  type LandingDemoResult,
} from "./landing-demo";

type ExampleTab = "form" | "schema" | "provider";

const tabs: readonly { id: ExampleTab; label: string }[] = [
  { id: "form", label: "Form" },
  { id: "schema", label: "Schema" },
  { id: "provider", label: "Provider" },
];

const files: Readonly<Record<ExampleTab, string>> = {
  form: "signup-form.tsx",
  provider: "providers.tsx",
  schema: "signup-form.tsx",
};

export interface HeroExampleProps {
  readonly providerCode: ReactNode;
  readonly schemaCode: ReactNode;
}

export function HeroExample({
  providerCode,
  schemaCode,
}: HeroExampleProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ExampleTab>("form");
  const [result, setResult] = useState<LandingDemoResult | null>(null);

  return (
    <div className="hero-example-stack">
      <div className="hero-example">
        <div className="hero-example-toolbar">
          <span className="hero-example-file">
            <i aria-hidden="true" />
            {files[activeTab]}
          </span>
          <div aria-label="Example view" className="hero-example-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                aria-controls={`hero-example-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                id={`example-tab-${tab.id}`}
                key={tab.id}
                onKeyDown={(event) => {
                  const current = tabs.findIndex((item) => item.id === activeTab);
                  const nextIndex = event.key === "ArrowRight"
                    ? (current + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (current - 1 + tabs.length) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : undefined;
                  if (nextIndex === undefined) return;
                  const next = tabs[nextIndex];
                  if (!next) return;
                  event.preventDefault();
                  setActiveTab(next.id);
                  requestAnimationFrame(() => {
                    document.getElementById(`example-tab-${next.id}`)?.focus();
                  });
                }}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          aria-labelledby="example-tab-form"
          className="hero-example-panel"
          hidden={activeTab !== "form"}
          id="hero-example-panel-form"
          role="tabpanel"
        >
          <LandingDemo onResult={setResult} />
        </div>
        <div
          aria-labelledby="example-tab-schema"
          className="hero-example-panel"
          hidden={activeTab !== "schema"}
          id="hero-example-panel-schema"
          role="tabpanel"
        >
          {schemaCode}
        </div>
        <div
          aria-labelledby="example-tab-provider"
          className="hero-example-panel"
          hidden={activeTab !== "provider"}
          id="hero-example-panel-provider"
          role="tabpanel"
        >
          {providerCode}
        </div>
      </div>

      <section
        aria-label="Typed output"
        className="hero-form-output"
        hidden={activeTab !== "form"}
      >
        <div>
          <h3>Typed output</h3>
          <span>z.output</span>
        </div>
        <code aria-atomic="true" aria-live="polite">
          {result
            ? JSON.stringify(result)
            : "Submit the form to see its schema output."}
        </code>
      </section>
    </div>
  );
}
