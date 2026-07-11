import { describe, expect, it } from "vitest";

import {
  FORM_SUBMISSION_ERROR_MAP,
  formSubmissionFailureSchema,
  isFormSubmissionFailureData,
} from "../src";

describe("form submission error data", () => {
  const failure = {
    errorKind: "business",
    fieldErrors: { email: ["Already registered"] },
    formErrors: [],
    status: "error",
  } as const;

  it("accepts the shared failed-submission shape", () => {
    expect(isFormSubmissionFailureData(failure)).toBe(true);
    expect(formSubmissionFailureSchema["~standard"].validate(failure)).toEqual({
      value: failure,
    });
    expect(FORM_SUBMISSION_ERROR_MAP).toEqual({
      FORM_SUBMISSION_FAILED: {
        data: formSubmissionFailureSchema,
        message: "Form submission failed",
        status: 422,
      },
    });
  });

  it.each([
    null,
    [],
    {},
    { ...failure, status: "success" },
    { ...failure, errorKind: "other" },
    { ...failure, fieldErrors: [] },
    { ...failure, fieldErrors: { email: "No" } },
    { ...failure, formErrors: "No" },
    { ...failure, extra: true },
  ])("rejects malformed error data %#", (value) => {
    expect(isFormSubmissionFailureData(value)).toBe(false);
    expect(formSubmissionFailureSchema["~standard"].validate(value)).toEqual({
      issues: [{ message: "Expected a FormAdapter failed submission." }],
    });
  });

  it("rejects hostile error data without throwing", () => {
    const hostile = Proxy.revocable({}, {});
    hostile.revoke();

    expect(isFormSubmissionFailureData(hostile.proxy)).toBe(false);
    expect(formSubmissionFailureSchema["~standard"].validate(hostile.proxy))
      .toEqual({
        issues: [{ message: "Expected a FormAdapter failed submission." }],
      });
  });
});
