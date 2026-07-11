import { type as arkType } from "arktype";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type {
  DeepPartial,
  FormSchema,
  JsonSchemaObject,
} from "@formadapter/core";

import {
  FORMADAPTER_ARRAY_MARKER,
  FORMADAPTER_BOOLEAN_MARKER,
  FORMADAPTER_VALUE_MARKER,
  parseFormData,
} from "../src";

describe("parseFormData", () => {
  it("decodes nested typed values, arrays, options, nulls, and files", async () => {
    const schema = z.object({
      avatar: z.file().optional(),
      contacts: z.array(z.object({
        email: z.email(),
        labels: z.array(z.string()),
        subscribed: z.boolean(),
      })),
      nickname: z.string().nullable(),
      preference: z.union([z.literal(1), z.literal(false), z.null()]),
      profile: z.object({
        active: z.boolean(),
        age: z.number().int(),
        role: z.enum(["admin", "user"]),
      }),
      scores: z.array(z.number()),
      tags: z.array(z.string()),
    }).strict();
    const avatar = new File(["image"], "avatar.png", { type: "image/png" });
    const formData = new FormData();
    formData.append(FORMADAPTER_ARRAY_MARKER, "contacts");
    formData.append(FORMADAPTER_ARRAY_MARKER, "contacts.0.labels");
    formData.append(FORMADAPTER_ARRAY_MARKER, "scores");
    formData.append(FORMADAPTER_ARRAY_MARKER, "tags");
    formData.append(FORMADAPTER_BOOLEAN_MARKER, "contacts.0.subscribed");
    formData.append(FORMADAPTER_BOOLEAN_MARKER, "profile.active");
    formData.set("avatar", avatar);
    formData.set("contacts.0.email", "ada@example.com");
    formData.set("contacts.0.labels.0", "work");
    formData.set("nickname", "");
    formData.set("preference", "boolean:false");
    formData.set("profile.age", "36");
    formData.set("profile.role", "string:admin");
    formData.set("scores.0", "10.5");
    formData.set("scores.1", "20");
    formData.set("tags.0", "typed");
    formData.set("tags.1", "forms");
    formData.set("unknown", "ignored");
    formData.set("$ACTION_ID_123", "ignored");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: {
        avatar,
        contacts: [{
          email: "ada@example.com",
          labels: ["work"],
          subscribed: false,
        }],
        nickname: null,
        preference: false,
        profile: { active: false, age: 36, role: "admin" },
        scores: [10.5, 20],
        tags: ["typed", "forms"],
      },
    });
  });

  it("preserves empty arrays and unchecked booleans with repeatable markers", async () => {
    const schema = z.object({
      enabled: z.boolean(),
      optionalEnabled: z.boolean().optional(),
      tags: z.array(z.string()),
    });
    const formData = new FormData();
    formData.append(FORMADAPTER_ARRAY_MARKER, "tags");
    formData.append(FORMADAPTER_ARRAY_MARKER, "notInSchema");
    formData.append(FORMADAPTER_BOOLEAN_MARKER, "enabled");
    formData.append(FORMADAPTER_BOOLEAN_MARKER, "notInSchema");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: { enabled: false, tags: [] },
    });
  });

  it("accepts repeated unindexed values for homogeneous arrays", async () => {
    const schema = z.object({ files: z.array(z.file()), values: z.array(z.number()) });
    const firstFile = new File(["one"], "one.txt");
    const secondFile = new File(["two"], "two.txt");
    const formData = new FormData();
    formData.append("files", firstFile);
    formData.append("files", secondFile);
    formData.append("values", "1");
    formData.append("values", "2.5");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: { files: [firstFile, secondFile], values: [1, 2.5] },
    });
  });

  it("omits an empty optional file and decodes nullable option variants", async () => {
    const schema = z.object({
      attachment: z.file().optional(),
      choice: z.union([z.literal(2), z.literal(true), z.null()]),
    });
    const formData = new FormData();
    formData.set("attachment", new File([], ""));
    formData.set("choice", "null:");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: { choice: null },
    });
  });

  it("normalizes blank optional text, object, and enum values to absence", async () => {
    const schema = z.object({
      nickname: z.string().optional(),
      profile: z.object({ alias: z.string().optional() }).optional(),
      role: z.enum(["admin", "user"]).optional(),
    }).strict();
    const formData = new FormData();
    formData.set("nickname", "");
    formData.set("profile.alias", "");
    formData.set("role", "");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: {},
    });
  });

  it("returns schema and root issues as structured errors", async () => {
    const jsonSchema: JsonSchemaObject = {
      properties: { age: { type: "number" } },
      required: ["age"],
      type: "object",
    };
    const schema: FormSchema<{ age: number }> = {
      "~standard": {
        jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
        types: undefined,
        validate: () => ({
          issues: [
            { message: "Age is invalid", path: ["age"] },
            { message: "The submission is invalid" },
          ],
        }),
        vendor: "fixture",
        version: 1,
      },
    };
    const formData = new FormData();
    formData.set("age", "not-a-number");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: false,
      fieldErrors: { age: ["Age is invalid"] },
      formErrors: ["The submission is invalid"],
    });
  });

  it("returns actionable feedback when a schema reports an empty failure", async () => {
    const jsonSchema: JsonSchemaObject = { type: "object" };
    const schema: FormSchema<Record<string, never>> = {
      "~standard": {
        jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
        types: undefined,
        validate: () => ({ issues: [] }),
        vendor: "fixture",
        version: 1,
      },
    };

    await expect(parseFormData(schema, new FormData())).resolves.toEqual({
      success: false,
      fieldErrors: {},
      formErrors: ["Schema validation failed"],
    });
  });

  it("combines presentation-required errors with authoritative schema errors", async () => {
    const schema = z.object({
      accountType: z.enum(["business", "personal"]),
      company: z.string().optional(),
      count: z.number(),
    });
    const formData = new FormData();
    formData.set("accountType", "string:business");
    formData.set("count", "invalid");

    const result = await parseFormData(schema, formData, {
      config: {
        fields: {
          company: {
            requiredMessage: "Company is required for businesses",
            requiredWhenVisible: (
              values: Readonly<DeepPartial<z.input<typeof schema>>>,
            ) => values.accountType === "business",
          },
        },
      },
    });

    expect(result).toMatchObject({
      success: false,
      fieldErrors: {
        company: ["Company is required for businesses"],
      },
      formErrors: [],
    });
    expect(result.success ? undefined : result.fieldErrors.count?.[0]).toBeTruthy();
  });

  it("supports async Standard Schema transformation", async () => {
    const jsonSchema: JsonSchemaObject = {
      properties: { age: { type: "number" } },
      required: ["age"],
      type: "object",
    };
    const schema: FormSchema<{ age: number }, { adult: boolean }> = {
      "~standard": {
        jsonSchema: { input: () => jsonSchema, output: () => ({ type: "object" }) },
        types: undefined,
        validate: async (value) => ({
          value: { adult: (value as { age: number }).age >= 18 },
        }),
        vendor: "fixture",
        version: 1,
      },
    };
    const formData = new FormData();
    formData.set("age", "21");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: { adult: true },
    });
  });

  it("uses the same decoding path with ArkType", async () => {
    const schema = arkType({ age: "number.integer", enabled: "boolean" });
    const formData = new FormData();
    formData.append(FORMADAPTER_BOOLEAN_MARKER, "enabled");
    formData.set("age", "42");
    formData.set("enabled", "true");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: { age: 42, enabled: true },
    });
  });

  it("decodes dynamically supplied option primitives", async () => {
    const schema = z.object({
      booleanChoice: z.boolean(),
      nullChoice: z.union([z.literal("value"), z.null()]),
      numberChoice: z.number(),
      stringChoice: z.string(),
    });
    const formData = new FormData();
    formData.set("booleanChoice", "boolean:true");
    formData.set("nullChoice", "null:");
    formData.set("numberChoice", "number:7.5");
    formData.set("stringChoice", "string:hello");

    await expect(parseFormData(schema, formData, {
      config: {
        fields: {
          booleanChoice: { options: () => [{ label: "Yes", value: true }] },
          nullChoice: { options: () => [{ label: "None", value: null }] },
          numberChoice: { options: () => [{ label: "Seven", value: 7.5 }] },
          stringChoice: { options: () => [{ label: "Hello", value: "hello" }] },
        },
      },
    })).resolves.toEqual({
      success: true,
      data: {
        booleanChoice: true,
        nullChoice: null,
        numberChoice: 7.5,
        stringChoice: "hello",
      },
    });
  });

  it("decodes marker-authorized typed values without model option metadata", async () => {
    const jsonSchema: JsonSchemaObject = {
      properties: {
        booleanChoice: { type: "string" },
        nullChoice: { type: "string" },
        numberChoice: { type: "string" },
        plainPrefixedText: { type: "string" },
        stringChoice: { type: "string" },
      },
      required: [
        "booleanChoice",
        "nullChoice",
        "numberChoice",
        "plainPrefixedText",
        "stringChoice",
      ],
      type: "object",
    };
    const schema: FormSchema<Record<string, unknown>> = {
      "~standard": {
        jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
        types: undefined,
        validate: (value) => ({ value: value as Record<string, unknown> }),
        vendor: "fixture",
        version: 1,
      },
    };
    const formData = new FormData();
    for (const path of [
      "booleanChoice",
      "nullChoice",
      "numberChoice",
      "stringChoice",
    ]) {
      formData.append(FORMADAPTER_VALUE_MARKER, path);
    }
    formData.set("booleanChoice", "boolean:false");
    formData.set("nullChoice", "null:");
    formData.set("numberChoice", "number:7.5");
    formData.set("plainPrefixedText", "number:7.5");
    formData.set("stringChoice", "string:hello");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: {
        booleanChoice: false,
        nullChoice: null,
        numberChoice: 7.5,
        plainPrefixedText: "number:7.5",
        stringChoice: "hello",
      },
    });
  });

  it("leaves malformed option and scalar payloads for schema validation", async () => {
    const schema = z.object({
      badBooleanOption: z.boolean().optional(),
      badBooleanScalar: z.boolean().optional(),
      badFile: z.file().optional(),
      badNullOption: z.union([z.literal("valid"), z.null()]).optional(),
      badNumberOption: z.number().optional(),
      badNumberScalar: z.number().optional(),
      badPrefixOption: z.literal("valid").optional(),
      emptyNumber: z.number().optional(),
      numberFile: z.number().optional(),
      zeroBoolean: z.boolean(),
    });
    const formData = new FormData();
    formData.set("badBooleanOption", "boolean:perhaps");
    formData.set("badBooleanScalar", "perhaps");
    formData.set("badFile", "not-a-file");
    formData.set("badNullOption", "null:not-empty");
    formData.set("badNumberOption", "number:not-a-number");
    formData.set("badNumberScalar", "not-a-number");
    formData.set("badPrefixOption", "other:value");
    formData.set("emptyNumber", "");
    formData.set("numberFile", new File(["x"], "value.txt"));
    formData.set("zeroBoolean", "0");

    const result = await parseFormData(schema, formData, {
      config: {
        fields: {
          badBooleanOption: { control: "select" },
          badNullOption: { control: "select" },
          badNumberOption: { control: "select" },
          badPrefixOption: { control: "select" },
        },
      },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors).toMatchObject({
      badBooleanOption: expect.any(Array),
      badBooleanScalar: expect.any(Array),
      badFile: expect.any(Array),
      badNullOption: expect.any(Array),
      badNumberOption: expect.any(Array),
      badNumberScalar: expect.any(Array),
      badPrefixOption: expect.any(Array),
      numberFile: expect.any(Array),
    });
    expect(result.fieldErrors.emptyNumber).toBeUndefined();
    expect(result.fieldErrors.zeroBoolean).toBeUndefined();
  });

  it("ignores unsafe, malformed, oversized, duplicate, and non-field paths", async () => {
    const schema = z.object({
      enabled: z.boolean(),
      items: z.array(z.object({ value: z.string() })),
      tags: z.array(z.string()),
    });
    const formData = new FormData();
    formData.append(FORMADAPTER_ARRAY_MARKER, "items");
    formData.append(FORMADAPTER_ARRAY_MARKER, "tags");
    formData.append(FORMADAPTER_ARRAY_MARKER, "tags");
    formData.append(FORMADAPTER_ARRAY_MARKER, "$ACTION_BAD");
    formData.append(FORMADAPTER_ARRAY_MARKER, new File([], "marker.txt"));
    formData.append(FORMADAPTER_BOOLEAN_MARKER, "enabled");
    formData.append(FORMADAPTER_BOOLEAN_MARKER, "enabled");
    formData.set("items", "objects-cannot-be-posted-without-indexed-fields");
    formData.set("tags..0", "bad");
    formData.set("tags.__proto__.0", "bad");
    formData.set("tags.10001", "bad");
    formData.set("", "bad");

    await expect(parseFormData(schema, formData)).resolves.toEqual({
      success: true,
      data: { enabled: false, items: [], tags: [] },
    });
  });

  it("normalizes non-string issue path keys without losing the error", async () => {
    const jsonSchema: JsonSchemaObject = {
      properties: { value: { type: "string" } },
      type: "object",
    };
    const schema: FormSchema<{ value?: string }> = {
      "~standard": {
        jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
        types: undefined,
        validate: () => ({
          issues: [{ message: "Symbol error", path: [Symbol.for("field")] }],
        }),
        vendor: "fixture",
        version: 1,
      },
    };

    await expect(parseFormData(schema, new FormData())).resolves.toEqual({
      success: false,
      fieldErrors: { "Symbol(field)": ["Symbol error"] },
      formErrors: [],
    });
  });

  it("keeps reserved issue paths as own error keys without touching prototypes", async () => {
    const jsonSchema: JsonSchemaObject = {
      properties: { value: { type: "string" } },
      type: "object",
    };
    const schema: FormSchema<{ value?: string }> = {
      "~standard": {
        jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
        types: undefined,
        validate: () => ({
          issues: [
            { message: "Reserved field error", path: ["__proto__"] },
            { message: "Constructor field error", path: ["constructor"] },
          ],
        }),
        vendor: "fixture",
        version: 1,
      },
    };

    const result = await parseFormData(schema, new FormData());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.hasOwn(result.fieldErrors, "__proto__")).toBe(true);
    expect(Object.hasOwn(result.fieldErrors, "constructor")).toBe(true);
    expect(result.fieldErrors["__proto__"]).toEqual(["Reserved field error"]);
    expect(result.fieldErrors.constructor).toEqual(["Constructor field error"]);
    expect(Object.prototype).not.toHaveProperty("Reserved field error");
  });

  it.each([
    FORMADAPTER_ARRAY_MARKER,
    FORMADAPTER_BOOLEAN_MARKER,
    FORMADAPTER_VALUE_MARKER,
    "$ACTION_ID_profile",
  ])("rejects the reserved top-level FormData field %s explicitly", async (name) => {
    const schema = z.object({ [name]: z.string() });
    const formData = new FormData();
    formData.set(name, "value");

    await expect(parseFormData(schema, formData)).rejects.toThrow(
      `Cannot decode FormData for unrepresentable field path ${JSON.stringify(name)}`,
    );
  });

  it.each([...new Set([
    "",
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
    "__formadapter_custom",
  ])])("rejects the unrepresentable FormData field %s explicitly", async (name) => {
    const jsonSchema: JsonSchemaObject = {
      properties: { [name]: { type: "string" } },
      required: [name],
      type: "object",
    };
    const schema: FormSchema<Record<string, string>> = {
      "~standard": {
        jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
        types: undefined,
        validate: (value) => ({ value: value as Record<string, string> }),
        vendor: "fixture",
        version: 1,
      },
    };
    const formData = new FormData();
    formData.set(name, "value");

    await expect(parseFormData(schema, formData)).rejects.toThrow(
      `Cannot decode FormData for unrepresentable field path ${JSON.stringify(name)}`,
    );
  });

  it("rejects reserved nested FormData paths instead of omitting them", async () => {
    const schema = z.object({
      profile: z.object({
        [FORMADAPTER_ARRAY_MARKER]: z.string(),
        $ACTION_ID_profile: z.string(),
      }),
    });
    const formData = new FormData();
    formData.set(`profile.${FORMADAPTER_ARRAY_MARKER}`, "marker value");
    formData.set("profile.$ACTION_ID_profile", "action value");

    await expect(parseFormData(schema, formData)).rejects.toThrow(
      /unrepresentable field path "profile.__formadapter_array", "profile.\$ACTION_ID_profile"/,
    );
  });
});
