"use client";

import { type } from "arktype";

import { createForm } from "@formadapter/react";

const schema = type({
  name: "2 <= string <= 60",
  email: "string.email",
  seats: "1 <= number.integer <= 100",
  plan: "'starter' | 'team' | 'enterprise'",
  newsletter: "boolean",
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
  plan: "starter" as const,
  newsletter: true,
};

export default function ArkTypeExample(): React.JSX.Element {
  return (
    <>
      <h1>ArkType</h1>
      <AccountForm.Form defaultValues={defaultValues} />
    </>
  );
}
