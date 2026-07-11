import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  compileForm,
  toInputJsonSchema,
  type FormSchema,
  type JsonSchemaObject,
} from "../src";

function schemaFromJson<Input extends object>(
  jsonSchema: JsonSchemaObject,
): FormSchema<Input> {
  return {
    "~standard": {
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
      types: undefined,
      validate: (value) => ({ value: value as Input }),
      vendor: "fixture",
      version: 1,
    },
  };
}

describe("JSON Schema composition", () => {
  it("installs ArkType's portable opaque-refinement fallback and honors strict mode", () => {
    let fallback: unknown;
    const schema: FormSchema<{ value: string }> = {
      "~standard": {
        jsonSchema: {
          input: (options) => {
            fallback = (options.libraryOptions?.fallback as
              | Readonly<Record<string, unknown>>
              | undefined)?.predicate;
            return {
              properties: { value: { type: "string" } },
              type: "object",
            };
          },
          output: () => ({ type: "object" }),
        },
        types: undefined,
        validate: (value) => ({ value: value as { value: string } }),
        vendor: "arktype",
        version: 1,
      },
    };

    compileForm(schema);
    expect(fallback).toBeTypeOf("function");
    const base = { type: "string" };
    expect((fallback as (context: { base: object }) => object)({ base })).toBe(base);

    fallback = undefined;
    toInputJsonSchema(schema, { jsonSchema: { opaqueRefinements: "error" } });
    expect(fallback).toBeUndefined();
  });

  it("intersects allOf constraints instead of allowing branch order to loosen them", () => {
    const first = compileForm(z.object({
      value: z.intersection(z.string().min(10), z.string().min(5)),
    })).fieldMap.value;
    const reversed = compileForm(z.object({
      value: z.intersection(z.string().min(5), z.string().min(10)),
    })).fieldMap.value;

    expect(first).toMatchObject({
      kind: "scalar",
      constraints: { minLength: 10 },
    });
    expect(reversed).toMatchObject({
      kind: "scalar",
      constraints: { minLength: 10 },
    });
  });

  it("combines lower, upper, array, required, and property constraints", () => {
    const schema = schemaFromJson<{
      count: number;
      names: string[];
      profile: { email: string; name: string };
    }>({
      properties: {
        count: {
          allOf: [
            { minimum: 1, type: "number" },
            { exclusiveMinimum: 3, maximum: 20, type: "number" },
            { maximum: 10, type: "number" },
          ],
        },
        names: {
          allOf: [
            { items: { minLength: 2, type: "string" }, minItems: 1, type: "array" },
            { items: { maxLength: 8, type: "string" }, maxItems: 3, type: "array" },
          ],
        },
        profile: {
          allOf: [
            {
              properties: { name: { minLength: 2, type: "string" } },
              required: ["name"],
              type: "object",
            },
            {
              properties: { email: { format: "email", type: "string" } },
              required: ["email"],
              type: "object",
            },
          ],
        },
      },
      required: ["count", "names", "profile"],
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.count).toMatchObject({
      constraints: { exclusiveMinimum: 3, maximum: 10 },
    });
    expect(model.fieldMap.names).toMatchObject({ minItems: 1, maxItems: 3 });
    expect(model.fieldMap["names[]"]).toMatchObject({
      constraints: { minLength: 2, maxLength: 8 },
    });
    expect(model.fieldMap["profile.name"]?.required).toBe(true);
    expect(model.fieldMap["profile.email"]).toMatchObject({
      required: true,
      control: "email",
    });
  });

  it("intersects $ref siblings rather than letting a weaker sibling overwrite the target", () => {
    const schema = schemaFromJson<{ code: string }>({
      $defs: {
        Code: { minLength: 10, type: "string" },
      },
      properties: {
        code: {
          $ref: "#/$defs/Code",
          minLength: 5,
          title: "Invite code",
        },
      },
      required: ["code"],
      type: "object",
    });

    expect(compileForm(schema).fieldMap.code).toMatchObject({
      kind: "scalar",
      label: "Invite code",
      constraints: { minLength: 10 },
    });
  });

  it("rejects impossible or non-representable intersections explicitly", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        impossibleLength: {
          allOf: [
            { minLength: 10, type: "string" },
            { maxLength: 5, type: "string" },
          ],
        },
        incompatibleTypes: {
          allOf: [{ type: "string" }, { type: "number" }],
        },
        patterns: {
          allOf: [
            { pattern: "^a", type: "string" },
            { pattern: "z$", type: "string" },
          ],
        },
      },
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.impossibleLength).toMatchObject({
      kind: "unsupported",
      reason: "The allOf string-length constraints cannot be satisfied",
    });
    expect(model.fieldMap.incompatibleTypes).toMatchObject({
      kind: "unsupported",
      reason: "The allOf branches require incompatible JSON Schema types",
    });
    expect(model.fieldMap.patterns).toMatchObject({
      kind: "unsupported",
      reason: "Multiple different patterns in allOf cannot be represented by one form control",
    });
  });

  it("does not mistake a repeated ref reached after allOf for a recursive schema", () => {
    const schema = schemaFromJson<{
      container: {
        nested: { value: string };
        value: string;
      };
    }>({
      $defs: {
        Shared: {
          properties: { value: { type: "string" } },
          required: ["value"],
          type: "object",
        },
      },
      properties: {
        container: {
          allOf: [
            { $ref: "#/$defs/Shared" },
            {
              properties: { nested: { $ref: "#/$defs/Shared" } },
              required: ["nested"],
              type: "object",
            },
          ],
        },
      },
      required: ["container"],
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap["container.value"]?.kind).toBe("scalar");
    expect(model.fieldMap["container.nested"]?.kind).toBe("object");
    expect(model.fieldMap["container.nested.value"]?.kind).toBe("scalar");
  });

  it("still detects direct and alias reference cycles without recursing forever", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      $defs: {
        AliasA: { $ref: "#/$defs/AliasB" },
        AliasB: { $ref: "#/$defs/AliasA" },
        Node: {
          properties: { child: { $ref: "#/$defs/Node" } },
          type: "object",
        },
      },
      properties: {
        alias: { $ref: "#/$defs/AliasA" },
        node: { $ref: "#/$defs/Node" },
      },
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.alias).toMatchObject({
      kind: "unsupported",
      reason: "Circular JSON Schema reference “#/$defs/AliasA”",
    });
    expect(model.fieldMap["node.child"]).toMatchObject({
      kind: "unsupported",
      reason: "Circular JSON Schema reference “#/$defs/Node”",
    });
  });

  it("keeps siblings of true refs and intersects enum values with type constraints", () => {
    const schema = schemaFromJson<{ enabled: string; mode: "safe" }>({
      $defs: { Anything: true },
      properties: {
        enabled: { $ref: "#/$defs/Anything", minLength: 2, type: "string" },
        mode: {
          allOf: [
            { enum: [1, "safe"], type: ["number", "string"] },
            { type: "string" },
          ],
        },
      },
      required: ["enabled", "mode"],
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.enabled).toMatchObject({
      kind: "scalar",
      constraints: { minLength: 2 },
    });
    expect(model.fieldMap.mode).toMatchObject({
      kind: "scalar",
      options: [{ label: "Safe", value: "safe" }],
    });
  });

  it("fails safely across conflicting composition keywords and impossible bounds", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      $defs: {
        AliasToAnything: { $ref: "#/$defs/Anything" },
        Anything: true,
      },
      properties: {
        aliasToTrue: { $ref: "#/$defs/AliasToAnything", type: "string" },
        arrayBounds: {
          allOf: [
            { items: { type: "string" }, minItems: 3, type: "array" },
            { items: { type: "string" }, maxItems: 1, type: "array" },
          ],
        },
        definitions: {
          allOf: [
            { $defs: { Local: { type: "string" } }, type: "string" },
            { $defs: { Local: { type: "number" } }, type: "string" },
          ],
        },
        closedObjects: {
          allOf: [
            {
              additionalProperties: false,
              properties: { left: { type: "string" } },
              type: "object",
            },
            {
              properties: { right: { type: "string" } },
              type: "object",
            },
          ],
        },
        enumValues: {
          allOf: [
            { enum: ["a", "b"], type: "string" },
            { const: "c", type: "string" },
          ],
        },
        formats: {
          allOf: [
            { format: "email", type: "string" },
            { format: "uri", type: "string" },
          ],
        },
        multiples: {
          allOf: [
            { multipleOf: 2, type: "number" },
            { multipleOf: 3, type: "number" },
          ],
        },
        numericBounds: {
          allOf: [
            { exclusiveMinimum: 5, type: "number" },
            { maximum: 5, type: "number" },
          ],
        },
        tuples: {
          allOf: [
            { items: [{ type: "string" }], type: "array" },
            { items: [{ type: "number" }], type: "array" },
          ],
        },
        unknownKeyword: {
          allOf: [
            { type: "string", "x-assertion": { a: [1] } },
            { type: "string", "x-assertion": { a: [2] } },
          ],
        },
        falseBranch: { allOf: [true, false] },
      },
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.aliasToTrue?.kind).toBe("scalar");
    for (const path of [
      "arrayBounds",
      "closedObjects",
      "definitions",
      "enumValues",
      "formats",
      "multiples",
      "numericBounds",
      "tuples",
      "unknownKeyword",
      "falseBranch",
    ]) {
      expect(model.fieldMap[path]?.kind).toBe("unsupported");
    }
  });

  it("composes compatible numeric, collection, and annotation constraints", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        count: {
          allOf: [
            {
              exclusiveMaximum: 20,
              minimum: 1,
              multipleOf: 2,
              readOnly: true,
              type: ["number", "integer"],
            },
            {
              exclusiveMinimum: 1,
              maximum: 20,
              multipleOf: 4,
              type: "integer",
              uniqueItems: true,
              writeOnly: true,
            },
          ],
        },
      },
      type: "object",
    });
    const count = compileForm(schema).fieldMap.count;

    expect(count).toMatchObject({
      kind: "scalar",
      config: { readOnly: true },
      constraints: {
        exclusiveMaximum: 20,
        exclusiveMinimum: 1,
        multipleOf: 4,
      },
      dataType: "integer",
    });
  });

  it("preserves compatible value, bound, and object-keyword intersections", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        additional: {
          allOf: [
            { additionalProperties: true, type: "object" },
            { additionalProperties: false, type: "object" },
          ],
        },
        bounded: {
          allOf: [
            {
              exclusiveMaximum: 10,
              exclusiveMinimum: 1,
              maximum: 10,
              minimum: 1,
              type: "number",
            },
            { type: "number" },
          ],
        },
        constrained: {
          allOf: [
            { const: "x", enum: ["x", "y"], type: "string" },
            { enum: ["x"], type: "string" },
          ],
        },
        propertyNames: {
          allOf: [
            { propertyNames: { minLength: 1, type: "string" }, type: "object" },
            { propertyNames: { maxLength: 5, type: "string" }, type: "object" },
          ],
        },
      },
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.additional?.kind).toBe("object");
    expect(model.fieldMap.bounded).toMatchObject({
      constraints: { exclusiveMaximum: 10, exclusiveMinimum: 1 },
    });
    expect(model.fieldMap.constrained).toMatchObject({
      options: [{ label: "X", value: "x" }],
    });
    expect(model.fieldMap.propertyNames?.kind).toBe("unsupported");
  });

  it("intersects enum values against every JSON Schema primitive/container type", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        arrayValue: { allOf: [{ enum: [[1]], type: "array" }, { enum: [[1]] }] },
        booleanValue: { allOf: [{ enum: [true], type: "boolean" }, { enum: [true] }] },
        integerValue: { allOf: [{ enum: [2], type: "integer" }, { enum: [2] }] },
        nullValue: { allOf: [{ enum: [null], type: "null" }, { enum: [null] }] },
        numberValue: { allOf: [{ enum: [2.5], type: "number" }, { enum: [2.5] }] },
        objectValue: { allOf: [{ enum: [{ ok: true }], type: "object" }, { enum: [{ ok: true }] }] },
        stringValue: { allOf: [{ enum: ["x"], type: "string" }, { enum: ["x"] }] },
        unknownValue: { allOf: [{ enum: ["x"], type: "custom" }, { enum: ["x"] }] },
      },
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.booleanValue?.kind).toBe("scalar");
    expect(model.fieldMap.integerValue?.kind).toBe("scalar");
    expect(model.fieldMap.numberValue?.kind).toBe("scalar");
    expect(model.fieldMap.nullValue?.kind).toBe("scalar");
    expect(model.fieldMap.objectValue?.kind).toBe("object");
    expect(model.fieldMap.stringValue?.kind).toBe("scalar");
    for (const path of ["arrayValue", "unknownValue"]) {
      expect(model.fieldMap[path]?.kind).toBe("unsupported");
    }
  });
});

describe("union, option, file, and control boundaries", () => {
  it("resolves referenced literal-union branches into typed options", () => {
    const schema = schemaFromJson<{ mode: "fast" | "safe" }>({
      $defs: {
        Fast: { const: "fast", title: "Fast lane", type: "string" },
        Safe: { const: "safe", title: "Safe lane", type: "string" },
      },
      properties: {
        mode: {
          oneOf: [
            { $ref: "#/$defs/Fast" },
            { $ref: "#/$defs/Safe" },
          ],
        },
      },
      required: ["mode"],
      type: "object",
    });

    expect(compileForm(schema).fieldMap.mode).toMatchObject({
      control: "select",
      options: [
        { label: "Fast lane", value: "fast" },
        { label: "Safe lane", value: "safe" },
      ],
    });
  });

  it("resolves referenced and compact nullable union branches without dropping non-null types", () => {
    const schema = schemaFromJson<{ compact: string | null; referenced: string | null }>({
      $defs: {
        Nil: { type: "null" },
        Text: { minLength: 2, type: "string" },
      },
      properties: {
        compact: { anyOf: [{ type: ["string", "null"] }] },
        enumCompact: { anyOf: [{ enum: ["value", null] }] },
        referenced: {
          anyOf: [
            { $ref: "#/$defs/Text" },
            { $ref: "#/$defs/Nil" },
          ],
        },
      },
      required: ["compact", "referenced"],
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.compact).toMatchObject({
      kind: "scalar",
      dataType: "string",
      nullable: true,
    });
    expect(model.fieldMap.enumCompact).toMatchObject({
      nullable: true,
      options: [
        { label: "Value", value: "value" },
        { label: "None", value: null },
      ],
    });
    expect(model.fieldMap.referenced).toMatchObject({
      kind: "scalar",
      dataType: "string",
      nullable: true,
      constraints: { minLength: 2 },
    });
  });

  it("deduplicates anyOf values but rejects overlapping oneOf literal branches", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        inclusive: {
          anyOf: [{ const: "same" }, { const: "same" }, { const: "other" }],
        },
        exclusive: {
          oneOf: [{ const: "same" }, { const: "same" }],
        },
      },
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fieldMap.inclusive).toMatchObject({
      kind: "scalar",
      options: [
        { label: "Same", value: "same" },
        { label: "Other", value: "other" },
      ],
    });
    expect(model.fieldMap.exclusive?.kind).toBe("unsupported");
  });

  it("turns all Zod file MIME alternatives into one accept list", () => {
    const attachment = compileForm(z.object({
      attachment: z.file().mime(["image/png", "image/jpeg"]),
    })).fieldMap.attachment;

    expect(attachment).toMatchObject({
      kind: "scalar",
      control: "file",
      dataType: "file",
      constraints: { accept: "image/png,image/jpeg" },
    });
  });

  it("rejects a file media union when one branch is not a MIME alternative", () => {
    const schema = schemaFromJson<{ attachment: unknown; missingMedia: unknown }>({
      properties: {
        attachment: {
          anyOf: [
            { contentMediaType: "image/png" },
            { contentMediaType: "image/jpeg", type: "number" },
          ],
          contentEncoding: "binary",
          format: "binary",
          type: "string",
        },
        missingMedia: {
          anyOf: [{ contentMediaType: "image/png" }, { maxLength: 100 }],
          contentEncoding: "binary",
          format: "binary",
          type: "string",
        },
      },
      type: "object",
    });

    const model = compileForm(schema);
    expect(model.fieldMap.attachment?.kind).toBe("unsupported");
    expect(model.fieldMap.missingMedia?.kind).toBe("unsupported");
  });

  it("preserves an intentionally empty configured option list as a select", () => {
    const role = compileForm(z.object({ role: z.string() }), {
      fields: { role: { options: [] } },
    }).fieldMap.role;

    expect(role).toMatchObject({
      kind: "scalar",
      control: "select",
      options: [],
    });
  });

  it("rejects empty and heterogeneous open type unions", () => {
    const schema = schemaFromJson<Record<string, unknown>>({
      properties: {
        "": { type: "string" },
        emptyEnum: { enum: [] },
        emptyType: { type: [] },
        emptyAnyOf: { anyOf: [] },
        open: { type: ["string", "number"] },
      },
      type: "object",
    });
    const model = compileForm(schema);

    expect(model.fields.find((field) => field.key === "")).toMatchObject({
      kind: "unsupported",
      reason: "Empty property names cannot be represented in a form path",
    });

    expect(model.fieldMap.emptyEnum).toMatchObject({
      kind: "unsupported",
      reason: "An empty enum can never be valid",
    });
    expect(model.fieldMap.emptyType).toMatchObject({
      kind: "unsupported",
      reason: "An empty type union can never be valid",
    });
    expect(model.fieldMap.open).toMatchObject({
      kind: "unsupported",
      reason: "Unsupported JSON Schema type “unknown”",
    });
    expect(model.fieldMap.emptyAnyOf).toMatchObject({
      kind: "unsupported",
      reason: "An empty union can never be valid",
    });
  });

  it("adds a null option to nullable literal choices", () => {
    const schema = schemaFromJson<{ mode: "safe" | null }>({
      properties: {
        mode: {
          anyOf: [
            { const: "safe", type: "string" },
            { type: "null" },
          ],
        },
      },
      required: ["mode"],
      type: "object",
    });

    expect(compileForm(schema).fieldMap.mode).toMatchObject({
      nullable: true,
      options: [
        { label: "Safe", value: "safe" },
        { label: "None", value: null },
      ],
    });
  });

  it("does not advertise a custom renderer name as a native input type", () => {
    const schema = z.object({ amount: z.number() });
    const field = compileForm<typeof schema, "currency">(schema, {
      fields: { amount: { control: "currency" } },
    }).fieldMap.amount;

    expect(field).toMatchObject({ control: "currency", kind: "scalar" });
    expect(field?.kind === "scalar" ? field.inputType : undefined).toBeUndefined();
  });
});
