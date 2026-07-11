import { type as arkType } from "arktype";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  SchemaConversionError,
  compileForm,
  defaultValueForNode,
  getDefaultValues,
  issuePath,
  issuesToFieldErrors,
  isEmptyFieldValue,
  isSubmissionState,
  optionForSerializedValue,
  pathToConfigPath,
  pathToName,
  prepareFormValues,
  resolveFieldState,
  serializeOptionValue,
  submissionFailure,
  submissionSuccess,
  toInputJsonSchema,
  validate,
  validatePresentationRules,
  type FormSchema,
  type JsonSchemaObject,
} from "../src";

function schemaFromJson<Input extends object>(
  jsonSchema: JsonSchemaObject,
  validator: (
    value: unknown,
  ) =>
    | { readonly value: Input }
    | { readonly issues: readonly { message: string; path?: readonly PropertyKey[] }[] }
    | Promise<
        | { readonly value: Input }
        | { readonly issues: readonly { message: string; path?: readonly PropertyKey[] }[] }
      > =
    (value) => ({ value: value as Input }),
  vendor = "fixture",
): FormSchema<Input> {
  return {
    "~standard": {
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
      types: undefined,
      validate: validator,
      vendor,
      version: 1,
    },
  };
}

describe("schema compilation", () => {
  it("compiles a rich Zod schema into stable, presentation-ready fields", () => {
    const schema = z.object({
      profile: z.object({
        email: z.email().meta({
          description: "Where replies go",
          title: "Work email",
          "x-formadapter-placeholder": "ada@example.com",
        }),
        bio: z.string().min(10).max(200).meta({
          "x-formadapter-control": "textarea",
        }),
      }),
      age: z.number().int().min(18).max(120).multipleOf(1),
      role: z.enum(["author", "editor"]),
      nickname: z.string().nullable().optional(),
      tags: z.array(z.string().min(2)).min(1).max(4).default(["typed"]),
      enabled: z.boolean().default(true),
      avatar: z.file().max(1024).mime("image/png").optional(),
    });
    const model = compileForm(schema, {
      fields: {
        age: { label: "Years", order: 0 },
        role: {
          control: "radio",
          options: [
            { label: "Writer", value: "author" },
            { label: "Reviewer", value: "editor" },
          ],
        },
        profile: { order: 2 },
        "profile.bio": { className: "wide", controlProps: { rows: 6 } },
      },
    });

    expect(model.root.kind).toBe("object");
    expect(model.fields[0]?.path).toBe("age");
    expect(model.fieldMap["profile.email"]).toMatchObject({
      control: "email",
      description: "Where replies go",
      inputType: "email",
      label: "Work email",
      path: "profile.email",
    });
    expect(model.fieldMap["profile.email"]?.config.placeholder).toBe(
      "ada@example.com",
    );
    expect(model.fieldMap["profile.bio"]).toMatchObject({
      control: "textarea",
      config: { className: "wide", controlProps: { rows: 6 } },
      constraints: { maxLength: 200, minLength: 10 },
    });
    expect(model.fieldMap.age).toMatchObject({
      control: "number",
      dataType: "integer",
      label: "Years",
      constraints: { maximum: 120, minimum: 18, multipleOf: 1 },
    });
    expect(model.fieldMap.role).toMatchObject({
      control: "radio",
      options: [
        { label: "Writer", value: "author" },
        { label: "Reviewer", value: "editor" },
      ],
    });
    expect(model.fieldMap.nickname).toMatchObject({ nullable: true, required: false });
    expect(model.fieldMap.tags).toMatchObject({
      kind: "array",
      minItems: 1,
      maxItems: 4,
    });
    expect(model.fieldMap["tags[]"]).toMatchObject({
      kind: "scalar",
      path: "tags[]",
      constraints: { minLength: 2 },
    });
    expect(model.fieldMap.avatar).toMatchObject({
      control: "file",
      dataType: "file",
      constraints: { accept: "image/png" },
    });
    expect(getDefaultValues(model)).toMatchObject({
      enabled: true,
      tags: ["typed"],
    });
  });

  it("uses the same compiler and authoritative validation for ArkType", async () => {
    const schema = arkType({
      email: "string.email",
      age: "18 <= number.integer <= 120",
      role: "'author' | 'editor'",
      tags: "string[]",
      "note?": "string <= 40",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.email).toMatchObject({
      control: "email",
      constraints: { format: "email" },
    });
    expect(model.fieldMap.age).toMatchObject({
      dataType: "integer",
      constraints: { maximum: 120, minimum: 18 },
    });
    const role = model.fieldMap.role;
    expect(role?.kind).toBe("scalar");
    expect(role?.kind === "scalar" ? role.options : undefined).toEqual([
      { label: "Author", value: "author" },
      { label: "Editor", value: "editor" },
    ]);
    expect(model.fieldMap.tags?.kind).toBe("array");

    await expect(
      validate(schema, {
        age: 36,
        email: "ada@example.com",
        role: "author",
        tags: ["typed"],
      }),
    ).resolves.toMatchObject({ success: true });
    const invalid = await validate(schema, {
      age: 12,
      email: "wrong",
      role: "author",
      tags: [],
    });
    expect(invalid.success).toBe(false);
  });

  it("resolves refs, allOf, literal unions, nullability, and flat metadata", () => {
    const schema = schemaFromJson<{
      consent: boolean | null;
      home: { city: string; zip: string };
      mode: "fast" | "safe";
      score: number | null;
    }>({
      $defs: {
        City: {
          properties: { city: { type: "string" } },
          required: ["city"],
          type: "object",
        },
        Zip: {
          properties: { zip: { pattern: "^[0-9]{5}$", type: "string" } },
          required: ["zip"],
          type: "object",
        },
        Address: {
          allOf: [
            { $ref: "#/$defs/City" },
            { $ref: "#/$defs/Zip" },
          ],
        },
        AddressAlias: { $ref: "#/$defs/Address" },
      },
      properties: {
        consent: { type: ["boolean", "null"] },
        home: { $ref: "#/$defs/AddressAlias", title: "Home address" },
        mode: {
          oneOf: [
            { const: "fast", title: "Fast lane" },
            { const: "safe", title: "Safe lane" },
          ],
          "x-formadapter-control": "radio",
          "x-formadapter-order": 0,
        },
        score: {
          anyOf: [{ type: "number" }, { type: "null" }],
          "x-formadapter-class-name": "score-field",
        },
      },
      required: ["consent", "home", "mode", "score"],
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fields[0]?.path).toBe("mode");
    expect(model.fieldMap.home).toMatchObject({
      kind: "object",
      label: "Home address",
    });
    expect(model.fieldMap["home.city"]?.required).toBe(true);
    expect(model.fieldMap["home.zip"]).toMatchObject({
      constraints: { pattern: "^[0-9]{5}$" },
    });
    expect(model.fieldMap.mode).toMatchObject({
      control: "radio",
      options: [
        { label: "Fast lane", value: "fast" },
        { label: "Safe lane", value: "safe" },
      ],
    });
    expect(model.fieldMap.consent).toMatchObject({
      control: "select",
      nullable: true,
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
        { label: "None", value: null },
      ],
    });
    expect(model.fieldMap.score).toMatchObject({
      nullable: true,
      config: { className: "score-field" },
    });
  });

  it("turns unsupported shapes into explicit diagnostic nodes", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      $defs: {
        Node: {
          properties: { child: { $ref: "#/$defs/Node" } },
          type: "object",
        },
      },
      properties: {
        impossible: false,
        open: true,
        tuple: { prefixItems: [{ type: "string" }], type: "array" },
        missingItems: { type: "array" },
        unknown: {},
        brokenRef: { $ref: "#/$defs/Missing" },
        recursive: { $ref: "#/$defs/Node" },
        objectUnion: {
          oneOf: [
            { properties: { a: { type: "string" } }, type: "object" },
            { properties: { b: { type: "string" } }, type: "object" },
          ],
        },
        record: {
          additionalProperties: { type: "string" },
          type: "object",
        },
      },
      type: "object",
    });
    const model = compileForm(schema);

    for (const path of [
      "impossible",
      "open",
      "tuple",
      "missingItems",
      "unknown",
      "brokenRef",
      "recursive.child",
      "objectUnion",
      "record",
    ]) {
      expect(model.fieldMap[path]?.kind).toBe("unsupported");
    }
  });

  it("normalizes common discriminated object unions into conditional fields", () => {
    const schema = z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("person"),
        name: z.string(),
      }),
      z.object({
        company: z.string(),
        kind: z.literal("company"),
      }),
    ]);
    const model = compileForm(schema);
    const kind = model.fieldMap.kind;
    const name = model.fieldMap.name;
    const company = model.fieldMap.company;

    expect(model.root.kind).toBe("object");
    expect(kind?.kind === "scalar" ? kind.options : undefined).toEqual([
      { label: "Person", value: "person" },
      { label: "Company", value: "company" },
    ]);
    expect(resolveFieldState(name?.config.hidden, { kind: "person" }, false)).toBe(false);
    expect(resolveFieldState(name?.config.hidden, { kind: "company" }, false)).toBe(true);
    expect(resolveFieldState(company?.config.requiredWhenVisible, { kind: "company" }, false)).toBe(true);
    expect(resolveFieldState(company?.config.requiredWhenVisible, { kind: "person" }, false)).toBe(false);
  });

  it("reports discriminated object unions inside arrays as an explicit boundary", () => {
    const schema = z.object({
      contacts: z.array(z.discriminatedUnion("kind", [
        z.object({ email: z.email(), kind: z.literal("email") }),
        z.object({ kind: z.literal("phone"), phone: z.string() }),
      ])),
    });

    const contacts = compileForm(schema, {}).fieldMap.contacts;
    expect(contacts?.kind).toBe("array");
    if (contacts?.kind !== "array") throw new Error("Expected an array field");
    expect(contacts.item).toMatchObject({
      kind: "unsupported",
      reason: "Discriminated object unions inside arrays are not supported yet",
    });
  });

  it("rejects multiple selection on a scalar file schema", () => {
    const schema = z.object({ attachment: z.file().optional() });
    const attachment = compileForm(schema, {
      fields: { attachment: { multiple: true } },
    }).fieldMap.attachment;

    expect(attachment).toMatchObject({
      kind: "unsupported",
      reason: "Multiple file selection requires an array-of-files schema",
    });
  });

  it("maps portable string formats and presentation extensions", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        birthday: { format: "date", type: "string" },
        createdAt: { format: "date-time", type: "string" },
        secret: { format: "password", type: "string" },
        phone: { format: "tel", type: "string" },
        meeting: { format: "time", type: "string" },
        site: { format: "url", type: "string" },
        query: {
          type: "string",
          "x-formadapter-disabled": true,
          "x-formadapter-hidden": false,
          "x-formadapter-multiple": true,
          "x-formadapter-placeholder": "Search",
          "x-formadapter-readonly": true,
        },
      },
      type: "object",
    });
    const model = compileForm(schema);

    const controlAt = (path: string): string | undefined => {
      const node = model.fieldMap[path];
      return node?.kind === "scalar" ? node.control : undefined;
    };
    expect(controlAt("birthday")).toBe("date");
    expect(controlAt("createdAt")).toBe("text");
    expect(controlAt("secret")).toBe("password");
    expect(controlAt("phone")).toBe("tel");
    expect(controlAt("meeting")).toBe("time");
    expect(controlAt("site")).toBe("url");
    expect(model.fieldMap.query?.config).toMatchObject({
      disabled: true,
      hidden: false,
      multiple: true,
      placeholder: "Search",
      readOnly: true,
    });
  });

  it("wraps JSON Schema conversion failures with vendor context", () => {
    const schema: FormSchema = {
      "~standard": {
        jsonSchema: {
          input: () => {
            throw new Error("opaque");
          },
          output: () => ({}),
        },
        types: undefined,
        validate: () => ({ value: undefined }),
        vendor: "mystery",
        version: 1,
      },
    };

    expect(() => toInputJsonSchema(schema)).toThrowError(SchemaConversionError);
    expect(() => compileForm(schema)).toThrow(/mystery schema/);
  });
});

describe("defaults, paths, and validation", () => {
  it("clones explicit defaults and supplies controlled required collection/boolean defaults", () => {
    const when = new Date("2026-07-09T00:00:00.000Z");
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        settings: {
          properties: {
            enabled: { type: "boolean" },
            flags: { items: { type: "string" }, type: "array" },
            payload: { default: { nested: ["one"] }, type: "object" },
            when: { default: when, type: "string" },
          },
          required: ["enabled", "flags"],
          type: "object",
        },
      },
      required: ["settings"],
      type: "object",
    });
    const model = compileForm(schema);
    const defaults = getDefaultValues(model) as {
      settings: {
        enabled: boolean;
        flags: string[];
        payload: { nested: string[] };
        when: Date;
      };
    };

    expect(defaults.settings).toMatchObject({ enabled: false, flags: [] });
    expect(defaults.settings.when).toEqual(when);
    expect(defaults.settings.when).not.toBe(when);
    expect(defaults.settings.payload).toEqual({ nested: ["one"] });
    expect(defaults.settings.payload).not.toBe(
      (model.fieldMap["settings.payload"]?.defaultValue as object),
    );
    expect(defaultValueForNode(model.fieldMap.settings!)).toEqual(defaults.settings);
  });

  it("preserves absence for pristine optional scalars and containers", () => {
    const schema = z.object({
      flag: z.boolean().optional(),
      settings: z.object({ name: z.string() }).optional(),
      tags: z.array(z.string()).optional(),
    });
    const model = compileForm(schema);

    expect(getDefaultValues(model)).toEqual({});
    expect(defaultValueForNode(model.fieldMap.flag!)).toBeUndefined();
    expect(defaultValueForNode(model.fieldMap.settings!)).toBeUndefined();
    expect(defaultValueForNode(model.fieldMap.tags!)).toBeUndefined();
  });

  it("seeds required homogeneous arrays from minItems", () => {
    const model = compileForm(z.object({
      people: z.array(z.object({ name: z.string() })).min(2),
      tags: z.array(z.string()).min(1),
    }));

    expect(getDefaultValues(model)).toEqual({
      people: [{ name: "" }, { name: "" }],
      tags: [""],
    });
  });

  it("validates requiredWhenVisible with the same empty semantics used by forms", () => {
    const schema = z.object({
      kind: z.enum(["person", "company"]),
      company: z.string().optional(),
      count: z.number().optional(),
      enabled: z.boolean().optional(),
    });
    const model = compileForm(schema, {
      fields: {
        company: {
          hidden: (values: { readonly kind?: "company" | "person" }) =>
            values.kind !== "company",
          requiredWhenVisible: true,
        },
        count: { requiredWhenVisible: true },
        enabled: { requiredWhenVisible: true },
      },
    });

    expect(validatePresentationRules(model, {
      count: 0,
      enabled: false,
      kind: "person",
    })).toEqual([]);
    expect(validatePresentationRules(model, { kind: "company" })).toEqual([
      { message: "Company is required", path: ["company"] },
      { message: "Count is required", path: ["count"] },
      { message: "Enabled is required", path: ["enabled"] },
    ]);
    expect(isEmptyFieldValue([])).toBe(true);
    expect(isEmptyFieldValue({ nested: "" })).toBe(true);
    expect(isEmptyFieldValue(0)).toBe(false);
    expect(isEmptyFieldValue(false)).toBe(false);
  });

  it("prepares optional blanks, nullable blanks, and empty optional objects", () => {
    const model = compileForm(z.object({
      nickname: z.string().optional(),
      note: z.string().nullable(),
      profile: z.object({ alias: z.string().optional() }).optional(),
      role: z.enum(["admin", "user"]).optional(),
    }));

    expect(prepareFormValues(model, {
      nickname: "",
      note: "",
      profile: { alias: "" },
      role: "",
    })).toEqual({ note: null });
  });

  it("prunes stale values from the inactive discriminated-union branch", () => {
    const schema = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("person"), name: z.string() }).strict(),
      z.object({ company: z.string(), kind: z.literal("company") }).strict(),
    ]);
    const model = compileForm(schema);

    expect(prepareFormValues(model, {
      company: "Stale Incorporated",
      kind: "person",
      name: "Ada",
    })).toEqual({ kind: "person", name: "Ada" });
  });

  it("prepares nested arrays and preserves values that schema validation must reject", () => {
    const schema = z.object({
      count: z.number().int(),
      rows: z.array(z.object({ label: z.string().optional() })),
      score: z.number(),
      tags: z.array(z.string()),
      title: z.string(),
      token: z.string().optional(),
    });
    const model = compileForm(schema, {
      fields: { token: { hidden: true } },
    });

    expect(prepareFormValues(model, {
      count: "",
      rows: [{ label: "" }, { label: "kept" }],
      score: "",
      tags: "invalid-array",
      title: "",
      token: "secret",
    })).toEqual({
      rows: [{}, { label: "kept" }],
      tags: "invalid-array",
      title: "",
    });
    expect(prepareFormValues(model, null)).toEqual({});
    expect(prepareFormValues(model, [])).toEqual({});

    const unsupportedModel = compileForm(schemaFromJson({
      properties: { custom: {} },
      required: ["custom"],
      type: "object",
    }));
    expect(prepareFormValues(unsupportedModel, {
      custom: { raw: true },
    })).toEqual({ custom: { raw: true } });
  });

  it("serializes typed options and constructs portable submission states", () => {
    const options = [
      { label: "One", value: 1 },
      { label: "Enabled", value: true },
      { label: "None", value: null },
    ] as const;
    expect(serializeOptionValue(1)).toBe("number:1");
    expect(serializeOptionValue(null)).toBe("null:");
    expect(optionForSerializedValue(options, "boolean:true")).toEqual(options[1]);
    expect(optionForSerializedValue(options, "missing")).toBeUndefined();

    const success = submissionSuccess({ id: 1 }, "Saved");
    const failure = submissionFailure({
      errorKind: "validation",
      fieldErrors: { name: ["Required"] },
    });
    expect(submissionFailure()).toEqual({
      errorKind: "business",
      fieldErrors: {},
      formErrors: [],
      status: "error",
    });
    expect(submissionSuccess()).toEqual({ status: "success" });
    expect(isSubmissionState(success)).toBe(true);
    expect(isSubmissionState(failure)).toBe(true);
    expect(isSubmissionState({ status: "idle" })).toBe(true);
    expect(isSubmissionState({ message: "Saved", status: "success" })).toBe(true);
    expect(isSubmissionState({ message: 1, status: "success" })).toBe(false);
    expect(isSubmissionState({ status: "error" })).toBe(false);
    expect(isSubmissionState({
      errorKind: "unknown",
      fieldErrors: {},
      formErrors: [],
      status: "error",
    })).toBe(false);
    expect(isSubmissionState({
      errorKind: "business",
      fieldErrors: { name: "Required" },
      formErrors: [],
      status: "error",
    })).toBe(false);
    expect(isSubmissionState({
      errorKind: "business",
      fieldErrors: {},
      formErrors: [1],
      status: "error",
    })).toBe(false);
    expect(isSubmissionState({
      errorKind: "business",
      fieldErrors: null,
      formErrors: [],
      status: "error",
    })).toBe(false);
    expect(isSubmissionState({
      errorKind: "transport",
      fieldErrors: [],
      formErrors: [],
      status: "error",
    })).toBe(false);
    expect(isSubmissionState({
      errorKind: "transport",
      fieldErrors: { name: [1] },
      formErrors: [],
      status: "error",
    })).toBe(false);
    expect(isSubmissionState({
      errorKind: "business",
      fieldErrors: {},
      formErrors: ["Nope"],
      status: "error",
    })).toBe(true);
    expect(isSubmissionState({
      errorKind: "transport",
      fieldErrors: { name: ["Nope"] },
      formErrors: [],
      status: "error",
    })).toBe(true);
    expect(isSubmissionState(null)).toBe(false);
    expect(isSubmissionState([])).toBe(false);
    expect(isSubmissionState({ status: "other" })).toBe(false);
    expect(success).toEqual({ data: { id: 1 }, message: "Saved", status: "success" });
    expect(failure).toMatchObject({ errorKind: "validation", status: "error" });
  });

  it("normalizes runtime and canonical paths", () => {
    expect(pathToName(["users", 2, "email"])).toBe("users.2.email");
    expect(pathToConfigPath(["users", 2, "email"])).toBe("users[].email");
    expect(pathToConfigPath([0, "name"])).toBe("[].name");
    expect(pathToConfigPath([])).toBe("");
  });

  it("preserves issue paths and groups field errors", async () => {
    const issues = [
      { message: "Form error" },
      { message: "Required", path: ["users", { key: 0 }, "email"] },
      { message: "Invalid", path: ["users", 0, "email"] },
      { message: "Symbol", path: [Symbol.for("token")] },
    ] as const;
    expect(issuePath(issues[1]!)).toEqual(["users", 0, "email"]);
    expect(issuesToFieldErrors(issues)).toEqual({
      "": ["Form error"],
      "Symbol(token)": ["Symbol"],
      "users.0.email": ["Required", "Invalid"],
    });

    const schema = schemaFromJson<{ ok: true }>(
      { properties: { ok: { const: true } }, required: ["ok"], type: "object" },
      async (value) =>
        (value as { ok?: unknown }).ok === true
          ? { value: { ok: true as const } }
          : { issues: [{ message: "Must be true", path: ["ok"] }] },
    );
    await expect(validate(schema, { ok: true })).resolves.toEqual({
      data: { ok: true },
      success: true,
    });
    await expect(validate(schema, { ok: false })).resolves.toEqual({
      issues: [{ message: "Must be true", path: ["ok"] }],
      success: false,
    });

    const emptyFailure = schemaFromJson<{ ok: true }>(
      { properties: { ok: { const: true } }, type: "object" },
      () => ({ issues: [] }),
    );
    await expect(validate(emptyFailure, {})).resolves.toEqual({
      issues: [{ message: "Schema validation failed" }],
      success: false,
    });
  });
});
