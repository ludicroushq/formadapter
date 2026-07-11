import { describe, expect, it } from "vitest";

import {
  FormAdapterServerError,
  fieldError,
  formError,
} from "../src";

describe("business error helpers", () => {
  it("normalizes form errors and preserves an explicit cause", () => {
    const cause = new Error("database rejected the write");
    const error = formError(["Try again", "Still unavailable"], { cause });

    expect(error).toBeInstanceOf(FormAdapterServerError);
    expect(error.message).toBe("Try again");
    expect(error.formErrors).toEqual(["Try again", "Still unavailable"]);
    expect(error.fieldErrors).toEqual({});
    expect(error.cause).toBe(cause);
  });

  it("creates field-scoped errors and supports an explicit public message", () => {
    const error = fieldError("email", "Already registered", {
      message: "Account conflict",
    });

    expect(error.message).toBe("Account conflict");
    expect(error.fieldErrors).toEqual({ email: ["Already registered"] });
    expect(error.formErrors).toEqual([]);
  });

  it("normalizes a full error and rejects empty field paths", () => {
    const error = new FormAdapterServerError({
      fieldErrors: { email: "Invalid", password: ["Too short"] },
    });
    expect(error.message).toBe("Invalid");
    expect(error.fieldErrors).toEqual({
      email: ["Invalid"],
      password: ["Too short"],
    });
    expect(() => fieldError("", "Invalid")).toThrow(TypeError);
    expect(new FormAdapterServerError().message).toBe("Submission failed");
  });
});
