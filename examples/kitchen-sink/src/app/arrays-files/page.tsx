"use client";

import { z } from "zod";

import { createForm } from "@formadapter/react";

const schema = z.object({
  tags: z
    .array(z.string().trim().min(2).max(24))
    .min(1)
    .max(5)
    .default(["react"]),
  collaborators: z
    .array(z.object({
      name: z.string().trim().min(2),
      email: z.email(),
      role: z.enum(["editor", "viewer"]),
    }).superRefine((collaborator, context) => {
      if (collaborator.email === "owner@example.com") {
        context.addIssue({
          code: "custom",
          message: "The project owner is already included",
        });
      }
    }))
    .min(1)
    .max(3)
    .default([{
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "editor",
    }]),
  attachment: z.file().max(2_000_000).mime("image/png").optional(),
});

const ProjectForm = createForm(schema).configure({
  fields: {
    tags: {
      array: { addLabel: "Add tag", itemLabel: "Tag" },
      label: "Tags",
    },
    collaborators: {
      array: {
        addLabel: "Add collaborator",
        itemLabel: "Collaborator",
      },
      label: "Collaborators",
    },
    "collaborators[].name": { label: "Name" },
    "collaborators[].email": { label: "Email" },
    "collaborators[].role": { control: "select", label: "Role" },
    attachment: { control: "file", label: "PNG attachment" },
  },
});

export default function ArraysAndFilesExample(): React.JSX.Element {
  return (
    <>
      <h1>Arrays and files</h1>
      <ProjectForm.Form />
    </>
  );
}
