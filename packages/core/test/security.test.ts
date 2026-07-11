import { describe, expect, it } from "vitest";

import {
  compileForm,
  getDefaultValues,
  issuePath,
  issuesToFieldErrors,
  isReservedFormPathSegment,
  isSubmissionState,
  prepareFormValues,
  submissionFailure,
  submissionSuccess,
  RESERVED_FORM_PATH_SEGMENTS,
  type FormSchema,
  type JsonSchemaObject,
} from "../src";

function schemaFromJson(
  jsonSchema: JsonSchemaObject,
): FormSchema<Record<string, string>> {
  return {
    "~standard": {
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
      types: undefined,
      validate: (value) => ({ value: value as Record<string, string> }),
      vendor: "fixture",
      version: 1,
    },
  };
}

describe("prototype-safe form records", () => {
  it("exports the canonical reserved-segment contract", () => {
    for (const name of Object.getOwnPropertyNames(Object.prototype)) {
      expect(RESERVED_FORM_PATH_SEGMENTS.has(name)).toBe(true);
      expect(isReservedFormPathSegment(name)).toBe(true);
    }
    expect(RESERVED_FORM_PATH_SEGMENTS.has("root")).toBe(true);
    expect(isReservedFormPathSegment("root")).toBe(true);
    expect(isReservedFormPathSegment("profile")).toBe(false);
  });

  it("keeps maps safe and explicitly rejects unrepresentable property paths", () => {
    const rejectedNames = [
      ...Object.getOwnPropertyNames(Object.prototype),
      "prototype",
      "root",
      "has.dot",
      "has[bracket]",
      "has'quote",
      'has"quote',
      "0",
      "01",
      "1e2",
      "0x10",
      " Infinity ",
      " ",
      "$ACTION_ID",
      "__formadapter_array",
      "__formadapter_boolean",
      "__formadapter_value",
      "__formadapter_custom",
    ];
    const properties = Object.fromEntries([
      ...rejectedNames.map((name) => [name, { type: "string" }] as const),
      ["safeName", { type: "string" }] as const,
    ]);
    const model = compileForm(schemaFromJson({
      properties,
      required: [...rejectedNames, "safeName"],
      type: "object",
    }));

    expect(Object.getPrototypeOf(model.fieldMap)).toBeNull();
    for (const key of rejectedNames) {
      expect(Object.hasOwn(model.fieldMap, key)).toBe(true);
      expect(model.fieldMap[key]).toMatchObject({ kind: "unsupported", path: key });
    }
    expect(model.fieldMap.safeName).toMatchObject({ kind: "scalar", path: "safeName" });
    expect(model.fieldMap.root).toMatchObject({
      kind: "unsupported",
      reason: "Property name “root” is reserved and cannot be represented safely in a form path",
    });
    expect(model.fieldMap.toString).toMatchObject({
      kind: "unsupported",
      reason: "Property name “toString” is reserved and cannot be represented safely in a form path",
    });

    const defaults = getDefaultValues(model) as Record<string, unknown>;
    expect(Object.getPrototypeOf(defaults)).toBe(Object.prototype);
    expect(Object.hasOwn(defaults, "__proto__")).toBe(false);
    expect(defaults).toEqual({ safeName: "" });

    const values = { safeName: "owned" };
    const prepared = prepareFormValues(model, values) as Record<string, unknown>;
    expect(prepared).toEqual(values);
  });

  it("does not resolve inherited JSON Pointer segments", () => {
    const model = compileForm(schemaFromJson({
      properties: { bad: { $ref: "#/constructor" } },
      type: "object",
    }));

    expect(model.fieldMap.bad).toMatchObject({
      kind: "unsupported",
      reason: "Unresolved JSON Schema reference “#/constructor”",
    });
  });

  it("groups hostile issue paths without collisions or prototype writes", () => {
    const errors = issuesToFieldErrors([
      { message: "Proto", path: ["__proto__"] },
      { message: "Constructor", path: ["constructor"] },
      { message: "String", path: ["toString"] },
      { message: "Again", path: ["__proto__"] },
    ]);

    expect(Object.getPrototypeOf(errors)).toBeNull();
    expect(errors["__proto__"]).toEqual(["Proto", "Again"]);
    expect(errors.constructor).toEqual(["Constructor"]);
    expect(errors.toString).toEqual(["String"]);
    expect(Object.prototype).not.toHaveProperty("Proto");
  });

  it("reads only an issue segment's own key", () => {
    const inherited = Object.create({ key: "inherited" }) as { key: string };
    expect(issuePath({ message: "No inherited keys", path: [inherited] })).toEqual([
      "[object Object]",
    ]);
  });
});

describe("submission-state recognition", () => {
  it("accepts helper states after a JSON round trip", () => {
    const states = [
      submissionSuccess({ id: 1 }, "Saved"),
      submissionFailure({
        errorKind: "validation",
        fieldErrors: JSON.parse('{"__proto__":["Required"]}') as Record<string, string[]>,
        formErrors: ["Fix the form"],
      }),
      { status: "idle" },
    ];

    for (const state of states) {
      expect(isSubmissionState(JSON.parse(JSON.stringify(state)))).toBe(true);
    }
    const emptyFailure = submissionFailure();
    expect(Object.getPrototypeOf(emptyFailure.fieldErrors)).toBeNull();
    expect(emptyFailure.fieldErrors.constructor).toBeUndefined();
  });

  it("does not mistake ordinary status-bearing domain values for states", () => {
    expect(isSubmissionState({ id: 42, status: "success" })).toBe(false);
    expect(isSubmissionState({ id: 42, status: "idle" })).toBe(false);
    expect(isSubmissionState({
      errorKind: "business",
      fieldErrors: {},
      formErrors: [],
      id: 42,
      status: "error",
    })).toBe(false);
    expect(isSubmissionState({ data: { id: 42 }, status: "success" })).toBe(true);
  });

  it("requires own discriminants and never throws for hostile objects", () => {
    expect(isSubmissionState(Object.create({ status: "success" }))).toBe(false);
    expect(isSubmissionState({
      get status(): never {
        throw new Error("getter should not escape");
      },
    })).toBe(false);
    expect(isSubmissionState(new Proxy({}, {
      ownKeys: () => {
        throw new Error("proxy should not escape");
      },
    }))).toBe(false);
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    expect(isSubmissionState(revocable.proxy)).toBe(false);
  });
});
