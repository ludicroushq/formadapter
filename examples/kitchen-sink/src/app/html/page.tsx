"use client";

import { z } from "zod";

import { createForm } from "@formadapter/html";

const Contact = createForm(z.object({
  email: z.email("Enter a valid email"),
  message: z.string().min(10, "Write at least 10 characters"),
})).configure({
  fields: { message: { control: "textarea" } },
});

export default function NativeHTMLExample(): React.JSX.Element {
  return (
    <>
      <h1>Native HTML</h1>
      <Contact.Form />
    </>
  );
}
