"use client";

import { createForm } from "@formadapter/react";

import {
  onboardingConfig,
  onboardingSchema,
} from "../../lib/onboarding";
import { saveOnboarding } from "./actions";

const OnboardingForm = createForm(onboardingSchema).configure(onboardingConfig);

const defaultValues = {
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  username: "ada-lovelace",
  accountType: "personal" as const,
  launchDate: "2026-10-01",
};

export default function NextServerActionExample(): React.JSX.Element {
  return (
    <>
      <h1>Next.js Server Action wizard</h1>
      <OnboardingForm.Wizard
        action={saveOnboarding}
        defaultValues={defaultValues}
        draft={{ key: "formadapter:example:onboarding" }}
        includeRemaining={false}
      >
        <OnboardingForm.Step title="Identity">
          <OnboardingForm.Field name="displayName" />
          <OnboardingForm.Field name="email" />
          <OnboardingForm.Field name="username" />
        </OnboardingForm.Step>
        <OnboardingForm.Step title="Launch setup">
          <OnboardingForm.Field name="accountType" />
          <OnboardingForm.Field name="company" />
          <OnboardingForm.Field name="launchDate" />
        </OnboardingForm.Step>
      </OnboardingForm.Wizard>
    </>
  );
}
