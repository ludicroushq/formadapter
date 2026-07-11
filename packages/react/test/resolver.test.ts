import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  compileForm,
  type AsyncFieldValidationContext,
  type AsyncFieldValidationSignal,
  type FormSchema,
} from "@formadapter/core";

import {
  createStandardResolver,
  flattenHookFormErrors,
  hookFormErrorItems,
  issuesToHookFormErrors,
  ownHookFormErrorMessage,
} from "../src/resolver";

function resolverOptions(names: string[]) {
  return {
    criteriaMode: "firstError" as const,
    fields: {},
    names,
    shouldUseNativeValidation: false,
  };
}

describe("Standard Schema resolver", () => {
  it("normalizes root, object, array, and path-segment issues", () => {
    const errors = issuesToHookFormErrors([
      { message: "Form failed" },
      { message: "Email failed", path: ["profile", { key: "email" }] },
      { message: "Item failed", path: ["items", 1, "name"] },
      { message: "Later duplicate", path: ["items", 1, "name"] },
    ]);

    expect(flattenHookFormErrors(errors)).toEqual({
      root: ["Form failed"],
      "profile.email": ["Email failed"],
      "items.1.name": ["Item failed", "Later duplicate"],
    });
  });

  it("stringifies non-string standard issue path keys", () => {
    const errors = issuesToHookFormErrors([{
      message: "Symbol failed",
      path: [{ key: Symbol("token") as never }],
    }]);

    expect(flattenHookFormErrors(errors)).toEqual({
      "Symbol(token)": ["Symbol failed"],
    });
  });

  it("preserves every message returned by an async field validator", async () => {
    const schema = z.object({ username: z.string() });
    const model = compileForm(schema, {
      fields: {
        username: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async () => [
            "Username is unavailable",
            "Username is reserved",
          ],
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);

    const result = await resolver(
      { username: "admin" },
      undefined,
      resolverOptions(["username"]),
    );

    expect(flattenHookFormErrors(result.errors)).toEqual({
      username: ["Username is unavailable", "Username is reserved"],
    });
  });

  it("turns thrown async validator values into safe field errors", async () => {
    const schema = z.object({ first: z.string(), second: z.string() });
    const model = compileForm(schema, {
      fields: {
        first: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async () => {
            throw new Error("Validator exploded");
          },
        },
        second: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async () => {
            throw "non-error rejection";
          },
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);

    const result = await resolver(
      { first: "one", second: "two" },
      undefined,
      resolverOptions(["first", "second"]),
    );

    expect(flattenHookFormErrors(result.errors)).toEqual({
      first: ["Validator exploded"],
      second: ["Validation failed"],
    });
  });

  it("preserves prototype-named paths without mutating object prototypes", () => {
    expect(Object.prototype).not.toHaveProperty("formadapterPolluted");

    const errors = issuesToHookFormErrors([
      { message: "Constructor failed", path: ["constructor"] },
      { message: "String conversion failed", path: ["toString"] },
      { message: "Prototype failed", path: ["__proto__"] },
      {
        message: "Nested prototype failed",
        path: ["profile", "__proto__", "formadapterPolluted"],
      },
    ]);

    expect(Object.prototype).not.toHaveProperty("formadapterPolluted");
    expect(Object.prototype.hasOwnProperty.call(errors, "constructor")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(errors, "toString")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(errors, "__proto__")).toBe(true);
    expect(flattenHookFormErrors(errors)).toEqual({
      ["__proto__"]: ["Prototype failed"],
      constructor: ["Constructor failed"],
      "profile.__proto__.formadapterPolluted": ["Nested prototype failed"],
      toString: ["String conversion failed"],
    });
  });

  it("keeps fields named ref and types and separates form errors from a root field", () => {
    const errors = issuesToHookFormErrors([
      { message: "Form failed" },
      { message: "Root field failed", path: ["root"] },
      { message: "Ref failed", path: ["ref"] },
      { message: "Types failed", path: ["types"] },
      { message: "Nested ref failed", path: ["profile", "ref"] },
      { message: "Nested types failed", path: ["profile", "types"] },
      {
        message: "Internal-looking field failed",
        path: ["__formadapter_root_error"],
      },
    ]);

    expect(flattenHookFormErrors(errors)).toEqual({
      root: ["Form failed", "Root field failed"],
      ref: ["Ref failed"],
      types: ["Types failed"],
      "profile.ref": ["Nested ref failed"],
      "profile.types": ["Nested types failed"],
      "__formadapter_root_error": ["Internal-looking field failed"],
    });
    expect(hookFormErrorItems(errors).slice(0, 2)).toEqual([
      { message: "Form failed" },
      { message: "Root field failed", path: "root" },
    ]);
  });

  it("keeps aggregate and child errors regardless of issue order", () => {
    const aggregateFirst = issuesToHookFormErrors([
      { message: "Review profile", path: ["profile"] },
      { message: "Enter a name", path: ["profile", "name"] },
    ]);
    const aggregateLast = issuesToHookFormErrors([
      { message: "Enter a name", path: ["profile", "name"] },
      { message: "Review profile", path: ["profile"] },
    ]);

    expect(flattenHookFormErrors(aggregateFirst)).toEqual({
      profile: ["Review profile"],
      "profile.name": ["Enter a name"],
    });
    expect(flattenHookFormErrors(aggregateLast)).toEqual({
      profile: ["Review profile"],
      "profile.name": ["Enter a name"],
    });
  });

  it("reads only an aggregate node's own error for inline groups", () => {
    const simultaneous = issuesToHookFormErrors([
      { message: "Review profile", path: ["profile"] },
      { message: "Enter a name", path: ["profile", "name"] },
    ]) as Readonly<Record<string, unknown>>;
    const childOnly = issuesToHookFormErrors([
      { message: "Enter a name", path: ["profile", "name"] },
    ]) as Readonly<Record<string, unknown>>;

    expect(ownHookFormErrorMessage(simultaneous.profile)).toBe(
      "Review profile",
    );
    expect(ownHookFormErrorMessage(childOnly.profile)).toBeUndefined();
    expect(ownHookFormErrorMessage(
      (childOnly.profile as Readonly<Record<string, unknown>>).name,
    )).toBe("Enter a name");
  });

  it("keeps aggregate errors beside children named like field-error metadata", () => {
    for (const child of [
      "message",
      "ref",
      "type",
      "types",
      "__formadapter_self_error",
    ] as const) {
      for (const aggregateFirst of [false, true]) {
        const aggregate = { message: "Review profile", path: ["profile"] };
        const nested = {
          message: `Fix ${child}`,
          path: ["profile", child],
        };
        const errors = issuesToHookFormErrors(
          aggregateFirst ? [aggregate, nested] : [nested, aggregate],
        );

        expect(flattenHookFormErrors(errors)).toEqual({
          profile: ["Review profile"],
          [`profile.${child}`]: [`Fix ${child}`],
        });
      }
    }
  });

  it("ignores message-less field-error metadata without traversing refs", () => {
    const cyclic: Record<string, unknown> = { type: "manual" };
    cyclic.ref = cyclic;

    expect(hookFormErrorItems({ field: cyclic } as never)).toEqual([]);
  });

  it("returns transformed output on success and nested errors on failure", async () => {
    const schema: FormSchema<{ count: string }, { count: number }> = {
      "~standard": {
        jsonSchema: {
          input: () => ({
            properties: { count: { type: "string" } },
            required: ["count"],
            type: "object",
          }),
          output: () => ({
            properties: { count: { type: "number" } },
            required: ["count"],
            type: "object",
          }),
        },
        types: undefined,
        validate: (value) => {
          const count = (value as { count?: unknown }).count;
          return typeof count === "string" && /^\d+$/.test(count)
            ? { value: { count: Number(count) } }
            : { issues: [{ message: "Use digits", path: ["count"] }] };
        },
        vendor: "test",
        version: 1,
      },
    };
    const resolver = createStandardResolver(schema);

    await expect(
      resolver({ count: "12" }, undefined, {
        criteriaMode: "firstError",
        fields: {},
        names: [],
        shouldUseNativeValidation: false,
      }),
    ).resolves.toEqual({ errors: {}, values: { count: 12 } });

    const failure = await resolver({ count: "no" }, undefined, {
      criteriaMode: "firstError",
      fields: {},
      names: [],
      shouldUseNativeValidation: false,
    });
    expect(flattenHookFormErrors(failure.errors)).toEqual({
      count: ["Use digits"],
    });
  });

  it("never hides authoritative errors outside requested or registered fields", async () => {
    const schema = z.object({
      active: z.string(),
      manual: z.string().min(1, "Manual is required"),
    }).refine(() => false, { message: "Form failed" });
    const resolver = createStandardResolver(schema, undefined, compileForm(schema));

    const failure = await resolver(
      { active: "yes", manual: "" },
      undefined,
      resolverOptions(["active"]),
    );

    expect(flattenHookFormErrors(failure.errors)).toEqual({
      manual: ["Manual is required"],
      root: ["Form failed"],
    });
  });

  it("keeps unrequested presentation-rule failures authoritative", async () => {
    const schema = z.object({
      active: z.string(),
      manual: z.string().optional(),
    });
    const model = compileForm(schema, {
      fields: {
        manual: {
          requiredMessage: "Manual is required while visible",
          requiredWhenVisible: true,
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);

    const failure = await resolver(
      { active: "yes", manual: "" },
      undefined,
      resolverOptions(["active"]),
    );

    expect(flattenHookFormErrors(failure.errors)).toEqual({
      manual: ["Manual is required while visible"],
    });
  });

  it("skips async validators for hidden fields and inherited hidden subtrees", async () => {
    const directValidator = vi.fn<(
      value: unknown,
      values: unknown,
      context: AsyncFieldValidationContext,
    ) => Promise<string>>(
      async () => "Direct should not run",
    );
    const nestedValidator = vi.fn<(
      value: unknown,
      values: unknown,
      context: AsyncFieldValidationContext,
    ) => Promise<undefined>>(
      async () => undefined,
    );
    const schema = z.object({
      direct: z.string(),
      hideGroup: z.boolean(),
      profile: z.object({ username: z.string() }),
    });
    const model = compileForm(schema, {
      fields: {
        direct: {
          asyncValidate: directValidator,
          asyncValidationDebounceMs: 0,
          hidden: true,
        },
        profile: {
          hidden: (values: Readonly<{ hideGroup?: boolean }>) =>
            values.hideGroup === true,
        },
        "profile.username": {
          asyncValidate: nestedValidator,
          asyncValidationDebounceMs: 0,
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);

    await expect(resolver(
      {
        direct: "secret",
        hideGroup: true,
        profile: { username: "hidden" },
      },
      undefined,
      resolverOptions(["direct", "profile.username"]),
    )).resolves.toEqual({
      errors: {},
      values: {
        direct: "secret",
        hideGroup: true,
        profile: { username: "hidden" },
      },
    });
    expect(directValidator).not.toHaveBeenCalled();
    expect(nestedValidator).not.toHaveBeenCalled();

    await resolver(
      {
        direct: "secret",
        hideGroup: false,
        profile: { username: "visible" },
      },
      undefined,
      resolverOptions(["profile.username"]),
    );
    expect(directValidator).not.toHaveBeenCalled();
    expect(nestedValidator).toHaveBeenCalledOnce();
    expect(nestedValidator.mock.calls[0]?.[1]).toMatchObject({
      hideGroup: false,
    });
  });

  it("exposes a lifecycle cleanup that aborts every pending validator", async () => {
    let started!: () => void;
    const validatorStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let signal: AsyncFieldValidationSignal | undefined;
    const schema = z.object({ username: z.string() });
    const model = compileForm(schema, {
      fields: {
        username: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (
            _value: unknown,
            _values: unknown,
            context: AsyncFieldValidationContext,
          ) => {
            signal = context.signal;
            started();
            return new Promise<undefined>(() => undefined);
          },
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);
    const pending = resolver(
      { username: "pending" },
      undefined,
      resolverOptions(["username"]),
    );

    await validatorStarted;
    resolver.dispose();

    expect(signal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({
      errors: {},
      values: { username: "pending" },
    });
  });

  it("aborts a pending validator when a separate field hides its subtree", async () => {
    let started!: () => void;
    const validatorStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let signal: AsyncFieldValidationSignal | undefined;
    const schema = z.object({
      enabled: z.boolean(),
      profile: z.object({ username: z.string() }),
    });
    const model = compileForm(schema, {
      fields: {
        profile: {
          hidden: (values: Readonly<{ enabled?: boolean }>) =>
            values.enabled === false,
        },
        "profile.username": {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (
            _value: unknown,
            _values: unknown,
            context: AsyncFieldValidationContext,
          ) => {
            signal = context.signal;
            started();
            return new Promise<undefined>(() => undefined);
          },
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);
    const stale = resolver(
      { enabled: true, profile: { username: "pending" } },
      undefined,
      resolverOptions(["profile.username"]),
    );

    await validatorStarted;
    const current = resolver(
      { enabled: false, profile: { username: "pending" } },
      undefined,
      resolverOptions(["enabled"]),
    );

    expect(signal?.aborted).toBe(true);
    await expect(current).resolves.toEqual({
      errors: {},
      values: { enabled: false, profile: { username: "pending" } },
    });
    await expect(stale).resolves.toEqual({
      errors: {},
      values: { enabled: true, profile: { username: "pending" } },
    });
  });

  it("supersedes pending async validation with a newer sync failure", async () => {
    let started!: () => void;
    const validatorStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let signal: AsyncFieldValidationSignal | undefined;
    const schema = z.object({ username: z.string().min(2, "Too short") });
    const model = compileForm(schema, {
      fields: {
        username: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (
            _value: unknown,
            _values: unknown,
            context: AsyncFieldValidationContext,
          ) => {
            signal = context.signal;
            started();
            return new Promise<undefined>(() => undefined);
          },
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);

    const stale = resolver(
      { username: "available" },
      undefined,
      resolverOptions(["username"]),
    );
    await validatorStarted;
    const current = resolver(
      { username: "x" },
      undefined,
      resolverOptions(["username"]),
    );

    expect(signal?.aborted).toBe(true);
    expect(flattenHookFormErrors((await current).errors)).toEqual({
      username: ["Too short"],
    });
    expect(flattenHookFormErrors((await stale).errors)).toEqual({
      username: ["Too short"],
    });
  });

  it("cancels an async array-item validator when its parent removes the item", async () => {
    let started!: () => void;
    const validatorStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let signal: AsyncFieldValidationSignal | undefined;
    const schema = z.object({
      items: z.array(z.object({ name: z.string() })),
    });
    const model = compileForm(schema, {
      fields: {
        "items[].name": {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (
            _value: unknown,
            _values: unknown,
            context: AsyncFieldValidationContext,
          ) => {
            signal = context.signal;
            started();
            return new Promise<undefined>(() => undefined);
          },
        },
      },
    });
    const resolver = createStandardResolver(schema, undefined, model);

    const stale = resolver(
      { items: [{ name: "pending" }] },
      undefined,
      resolverOptions(["items.0.name"]),
    );
    await validatorStarted;
    const current = resolver(
      { items: [] },
      undefined,
      resolverOptions(["items"]),
    );

    expect(signal?.aborted).toBe(true);
    await expect(current).resolves.toEqual({ errors: {}, values: { items: [] } });
    await expect(stale).resolves.toEqual({ errors: {}, values: { items: [] } });
  });
});
