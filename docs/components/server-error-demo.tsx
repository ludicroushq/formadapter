"use client";

import { z } from "zod";

import { submissionFailure } from "@formadapter/core";
import { DaisyUIProvider } from "@formadapter/daisyui";
import { createForm } from "@formadapter/react";

const profileSchema = z.object({
  email: z.email(),
});

const ProfileForm = createForm(profileSchema).configure({
  fields: {
    email: {
      label: "Work email",
      placeholder: "you@company.com",
    },
  },
});

function createServerError() {
  return submissionFailure({
    fieldErrors: {
      email: ["Already registered"],
    },
  });
}

const initialServerError = createServerError();

const defaultValues = {
  email: "used@example.com",
};

export function ServerErrorDemo(): React.JSX.Element {
  return (
    <DaisyUIProvider prefix="fa-">
      <div className="fa-daisy server-form-demo" data-theme="light">
        <div className="server-form-meta">
          <span>Rendered form</span>
          <span>Server field error</span>
        </div>
        <ProfileForm.Form
          defaultValues={defaultValues}
          initialSubmissionState={initialServerError}
          onSubmit={createServerError}
          submitLabel="Save profile"
        />
      </div>
    </DaisyUIProvider>
  );
}
