"use server";

import type { SubmissionState } from "@formadapter/core";
import {
  createNextAction,
  fieldError,
} from "@formadapter/nextjs";

import {
  onboardingConfig,
  onboardingSchema,
} from "../../lib/onboarding";

const submitOnboarding = createNextAction(
  onboardingSchema,
  async (values) => {
    if (values.email === "used@example.com") {
      throw fieldError("email", "That email already belongs to an account");
    }

    return { launchDate: values.launchDate.toISOString() };
  },
  { config: onboardingConfig },
);

type OnboardingData = {
  readonly launchDate: string;
};

export async function saveOnboarding(
  previousState: SubmissionState<OnboardingData>,
  formData: FormData,
): Promise<SubmissionState<OnboardingData>> {
  const result = await submitOnboarding(previousState, formData);
  return result.status === "success"
    ? { ...result, message: "Onboarding saved" }
    : result;
}
