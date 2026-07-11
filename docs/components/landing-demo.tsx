"use client";

import { z } from "zod";

import { DaisyUIProvider } from "@formadapter/daisyui";
import { createForm } from "@formadapter/react";

const signupSchema = z.object({
  email: z.email(),
  accountType: z.enum(["personal", "company"]).default("company"),
  company: z.string().trim().min(2).optional(),
});

const Signup = createForm(signupSchema).configure({
  fields: {
    email: {
      label: "Work email",
      placeholder: "ada@example.com",
    },
    accountType: {
      control: "radio",
      label: "Account type",
      options: [
        { label: "Personal", value: "personal" },
        { label: "Company", value: "company" },
      ],
    },
    company: {
      hidden: (values) => values.accountType !== "company",
      label: "Company name",
      requiredWhenVisible: (values) => values.accountType === "company",
    },
  },
});

export type LandingDemoResult = z.output<typeof signupSchema>;

export interface LandingDemoProps {
  readonly onResult: (result: LandingDemoResult) => void;
}

const defaultValues = {
  accountType: "company" as const,
  company: "Analytical Engines Ltd.",
  email: "ada@example.com",
};

export function LandingDemo({ onResult }: LandingDemoProps): React.JSX.Element {
  return (
    <DaisyUIProvider prefix="fa-">
      <div className="fa-daisy hero-live-form" data-theme="light">
        <div className="hero-form-heading">
          <h2>Create your workspace</h2>
          <p>This form is rendered directly from the schema.</p>
        </div>

        <Signup.Form
          defaultValues={defaultValues}
          onSubmit={(values) => {
            onResult(values);
            return {
              status: "success",
              message: "Validated by the original Zod schema.",
            };
          }}
          resetOnSuccess={false}
          submitLabel="Create workspace"
        />
      </div>
    </DaisyUIProvider>
  );
}
