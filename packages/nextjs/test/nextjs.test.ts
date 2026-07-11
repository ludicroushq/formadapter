import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createNextAction, fieldError } from "../src";

describe("Next.js actions", () => {
  it("creates the exact previous-state/FormData action contract", async () => {
    const action = createNextAction(
      z.object({ email: z.email() }),
      ({ email }) => {
        if (email === "used@example.com") throw fieldError("email", "Already used");
        return { email };
      },
    );
    const formData = new FormData();
    formData.set("email", "used@example.com");

    const result = await action({ status: "idle" }, formData);
    expect(result).toMatchObject({
      fieldErrors: { email: ["Already used"] },
      status: "error",
    });
    if (result.status !== "error") throw new Error("Expected an error state");
    expect(Object.getPrototypeOf(result.fieldErrors)).toBe(Object.prototype);
  });

  it("does not confuse domain data with the shared action state", async () => {
    const domainResult = { id: 42, status: "success" } as const;
    const action = createNextAction(
      z.object({ email: z.email() }),
      () => domainResult,
    );
    const formData = new FormData();
    formData.set("email", "ada@example.com");

    await expect(action({ status: "idle" }, formData)).resolves.toEqual({
      data: domainResult,
      status: "success",
    });
  });

  it("rejects schema fields that collide with Next's action metadata", async () => {
    const action = createNextAction(
      z.object({ $ACTION_ID_profile: z.string() }),
      () => undefined,
    );
    const formData = new FormData();
    formData.set("$ACTION_ID_profile", "user value");

    await expect(action({ status: "idle" }, formData)).rejects.toThrow(
      /unrepresentable field path "\$ACTION_ID_profile"/,
    );
  });
});
