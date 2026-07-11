import { submissionFailure } from "@formadapter/core";
import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_ORPC_ERROR_MESSAGE,
  isORPCErrorLike,
  orpcErrorToSubmission,
  unknownErrorToSubmission,
} from "../src";

describe("oRPC error normalization", () => {
  it("recognizes only complete oRPC errors", () => {
    expect(
      isORPCErrorLike({ code: "CONFLICT", message: "Conflict", status: 409 }),
    ).toBe(true);
    expect(isORPCErrorLike(null)).toBe(false);
    expect(isORPCErrorLike({ code: "CONFLICT", message: "Conflict" })).toBe(
      false,
    );
    expect(isORPCErrorLike({ code: 1, message: "Conflict", status: 409 })).toBe(
      false,
    );
    expect(
      isORPCErrorLike({ code: "CONFLICT", message: "Conflict", status: Infinity }),
    ).toBe(false);
  });

  it("handles hostile error objects without throwing", () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const hostileData = {
      code: "BAD_REQUEST",
      get data(): never {
        throw new Error("hostile data getter");
      },
      message: "Do not expose this",
      status: 400,
    };

    expect(isORPCErrorLike(revoked.proxy)).toBe(false);
    expect(orpcErrorToSubmission(revoked.proxy)).toBeUndefined();
    expect(unknownErrorToSubmission(revoked.proxy)).toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: [DEFAULT_ORPC_ERROR_MESSAGE],
      }),
    );
    expect(unknownErrorToSubmission(hostileData)).toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: [DEFAULT_ORPC_ERROR_MESSAGE],
      }),
    );
  });

  it("maps the shared typed business failure without changing it", () => {
    const failure = submissionFailure({
      fieldErrors: { email: ["Already registered"] },
    });
    expect(
      orpcErrorToSubmission({
        code: "FORM_SUBMISSION_FAILED",
        data: failure,
        defined: true,
        message: "Form submission failed",
        status: 422,
      }),
    ).toBe(failure);
  });

  it("maps Standard Schema issues to nested field and form errors", () => {
    const hostileIssue = Proxy.revocable({}, {});
    hostileIssue.revoke();
    expect(
      orpcErrorToSubmission({
        code: "BAD_REQUEST",
        data: {
          issues: [
            { message: "Invalid email", path: ["user", "email"] },
            { message: "Invalid member", path: ["members", 0, { key: "name" }] },
            { message: "Whole form is invalid" },
            { message: "Ignored invalid path", path: [null] },
            { message: "Ignored invalid key", path: [{ key: null }] },
            hostileIssue.proxy,
            null,
          ],
        },
        message: "Input validation failed",
        status: 400,
      }),
    ).toEqual({
      errorKind: "validation",
      fieldErrors: {
        "members.0.name": ["Invalid member"],
        "user.email": ["Invalid email"],
      },
      formErrors: ["Whole form is invalid"],
      status: "error",
    });
  });

  it("maps actual ORPCError instances structurally", () => {
    expect(
      unknownErrorToSubmission(
        new ORPCError("CONFLICT", {
          message: "That record changed.",
        }),
      ),
    ).toEqual(
      submissionFailure({
        formErrors: ["That record changed."],
      }),
    );
  });

  it("falls back from BAD_REQUEST when no Standard Schema issues are present", () => {
    expect(
      orpcErrorToSubmission({
        code: "BAD_REQUEST",
        data: {},
        message: "Bad request",
        status: 400,
      }),
    ).toEqual(submissionFailure({ formErrors: ["Bad request"] }));
  });

  it("uses the known validation message when an issues payload is empty", () => {
    expect(
      orpcErrorToSubmission({
        code: "BAD_REQUEST",
        data: { issues: [] },
        message: "Input validation failed",
        status: 400,
      }),
    ).toEqual(
      submissionFailure({
        errorKind: "validation",
        formErrors: ["Input validation failed"],
      }),
    );
    expect(
      orpcErrorToSubmission(
        {
          code: "BAD_REQUEST",
          data: { issues: [] },
          message: "",
          status: 400,
        },
        "Check the form and try again.",
      ),
    ).toEqual(
      submissionFailure({
        errorKind: "validation",
        formErrors: ["Check the form and try again."],
      }),
    );
  });

  it("shows intentional client-safe messages but hides server messages", () => {
    expect(
      orpcErrorToSubmission({
        code: "CONFLICT",
        message: "That name is unavailable.",
        status: 409,
      }),
    ).toEqual(
      submissionFailure({
        formErrors: ["That name is unavailable."],
      }),
    );
    expect(
      orpcErrorToSubmission({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database password leaked here",
        status: 500,
      }),
    ).toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: [DEFAULT_ORPC_ERROR_MESSAGE],
      }),
    );
    expect(
      orpcErrorToSubmission(
        { code: "INTERNAL_SERVER_ERROR", message: "", status: 500 },
        "Try later.",
      ),
    ).toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: ["Try later."],
      }),
    );
    expect(
      orpcErrorToSubmission({
        code: "REDIRECT",
        message: "Internal redirect target",
        status: 302,
      }),
    ).toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: [DEFAULT_ORPC_ERROR_MESSAGE],
      }),
    );
  });

  it("returns undefined for non-oRPC values and safely normalizes them", () => {
    const error = new Error("Do not expose this implementation detail");
    expect(orpcErrorToSubmission(error)).toBeUndefined();
    expect(unknownErrorToSubmission(error)).toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: [DEFAULT_ORPC_ERROR_MESSAGE],
      }),
    );
  });

  it("falls back safely for malformed typed form data and blank messages", () => {
    expect(
      unknownErrorToSubmission({
        code: "FORM_SUBMISSION_FAILED",
        data: { status: "error" },
        message: "Form submission failed",
        status: 422,
      }),
    ).toEqual(submissionFailure({ formErrors: ["Form submission failed"] }));
    expect(
      unknownErrorToSubmission({ code: "BAD_GATEWAY", message: "", status: 502 }),
    ).toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: [DEFAULT_ORPC_ERROR_MESSAGE],
      }),
    );
  });
});
