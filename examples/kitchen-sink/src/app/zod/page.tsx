"use client";

import { z } from "zod";

import { createForm } from "@formadapter/react";

const schema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  seats: z.number().int().min(1).max(100),
  plan: z.enum(["starter", "team", "enterprise"]).default("starter"),
  newsletter: z.boolean().default(true),
});

const AccountForm = createForm(schema).configure({
  fields: {
    name: { label: "Name" },
    email: { label: "Email" },
    seats: { label: "Seats" },
    plan: { control: "select", label: "Plan" },
    newsletter: { label: "Subscribe to product updates" },
  },
});

const defaultValues = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  seats: 4,
};

export default function ZodExample(): React.JSX.Element {
  return (
    <>
      <h1>Zod</h1>
      <AccountForm.Form defaultValues={defaultValues} />
    </>
  );
}
