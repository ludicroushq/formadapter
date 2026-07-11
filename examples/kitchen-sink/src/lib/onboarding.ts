import { z } from "zod";

import type { FormConfig } from "@formadapter/core";

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  email: z.email(),
  username: z.string().regex(/^[a-z][a-z0-9-]{2,19}$/),
  accountType: z.enum(["personal", "company"]).default("personal"),
  company: z.string().trim().min(2).optional(),
  launchDate: z.iso.date().pipe(z.coerce.date()),
});

export const onboardingConfig: FormConfig<
  z.input<typeof onboardingSchema>,
  never
> = {
  fields: {
    displayName: {
      label: "Display name",
      placeholder: "Ada Lovelace",
    },
    email: {
      description: "Try used@example.com to see a server-owned field error.",
      label: "Work email",
      placeholder: "ada@example.com",
    },
    username: {
      asyncValidationDebounceMs: 250,
      asyncValidate: async (value, _values, { signal }) => {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 350);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
        if (signal.aborted) return undefined;
        return value === "admin" ? "That username is reserved" : undefined;
      },
      description: "Availability is checked asynchronously. Try admin.",
      label: "Username",
      placeholder: "ada-lovelace",
    },
    accountType: {
      label: "Account type",
    },
    company: {
      hidden: (values) => values.accountType !== "company",
      label: "Company name",
      placeholder: "Analytical Engines Ltd.",
      requiredWhenVisible: (values) => values.accountType === "company",
    },
    launchDate: {
      description: "The input is a date string; the Zod output is a Date.",
      label: "Launch date",
    },
  },
};
