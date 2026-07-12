"use client";

import { z } from "zod";

import { createForm } from "@formadapter/react";

const Contact = createForm(z.object({
  email: z.email("Enter a valid email"),
  message: z.string().min(10, "Write at least 10 characters"),
  plan: z.enum(["starter", "team"]),
  terms: z.literal(true).meta({ title: "Accept terms" }),
})).configure({
  fields: {
    message: { control: "textarea" },
    plan: { control: "radio" },
    terms: { control: "checkbox" },
  },
});

export default function ShadcnRadixExample(): React.JSX.Element {
  return (
    <>
      <h1>shadcn/ui with Radix UI</h1>
      <Contact.Form />
    </>
  );
}
