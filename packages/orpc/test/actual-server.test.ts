import { submissionFailure } from "@formadapter/core";
import { os } from "@orpc/server";
import { describe, expect, it } from "vitest";

import {
  createORPCSubmission,
  FORM_SUBMISSION_ERROR_MAP,
} from "../src";

function submitContext(input: unknown) {
  return {
    formData: new FormData(),
    input,
    signal: new AbortController().signal,
  };
}

describe("oRPC 1.14 server compatibility", () => {
  it("installs the error map and maps its real generated error constructor", async () => {
    const failure = submissionFailure({
      fieldErrors: { email: ["That email is already registered."] },
    });
    const procedure = os
      .errors(FORM_SUBMISSION_ERROR_MAP)
      .handler(({ errors }) => {
        throw errors.FORM_SUBMISSION_FAILED({ data: failure });
      })
      .callable();
    const submit = createORPCSubmission(procedure);

    await expect(submit(undefined, submitContext(undefined))).resolves.toBe(
      failure,
    );
  });

  it("maps oRPC's real default BAD_REQUEST Standard Schema payload", async () => {
    const rejectingSchema = {
      "~standard": {
        validate: () => ({
          issues: [
            { message: "Invalid email", path: ["user", "email"] },
          ],
        }),
        vendor: "fixture",
        version: 1,
      },
    } as const;
    const procedure = os
      .input(rejectingSchema)
      .handler(() => "unreachable")
      .callable();
    const submit = createORPCSubmission(procedure);

    await expect(submit({}, submitContext({ user: { email: "bad" } })))
      .resolves.toEqual(
        submissionFailure({
          errorKind: "validation",
          fieldErrors: { "user.email": ["Invalid email"] },
        }),
      );
  });
});
