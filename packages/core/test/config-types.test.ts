import { expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  compileForm,
  type FieldPath,
  type FormConfig,
  type PathValue,
} from "../src";

it("types defaults and options from each schema field", () => {
  const schema = z.object({
    choice: z.enum(["a", "b"]),
    count: z.number(),
    profile: z.object({ name: z.string() }),
  });
  type Input = z.input<typeof schema>;

  const config = {
    fields: {
      choice: {
        defaultValue: "a",
        options: (values) => {
          expectTypeOf(values.count).toEqualTypeOf<number | undefined>();
          return [{ label: "A", value: "a" }] as const;
        },
      },
      count: {
        defaultValue: 1,
        options: [{ label: "One", value: 1 }],
      },
    },
  } satisfies FormConfig<Input>;

  expect(compileForm(schema, config).fieldMap.choice).toMatchObject({
    defaultValue: "a",
  });

  compileForm(schema, {
    fields: {
      choice: {
        // @ts-expect-error - the default must belong to this field
        defaultValue: "c",
      },
      count: {
        options: [{
          label: "Wrong",
          // @ts-expect-error - numeric fields cannot expose string option values
          value: "one",
        }],
      },
      profile: {
        options: [{
          label: "Not scalar",
          // @ts-expect-error - object fields have no primitive option value
          value: "profile",
        }],
      },
    },
  });
});

it("infers nested-array paths and values without exposing array methods", () => {
  type Input = {
    matrix: string[][];
    teams: Array<Array<{ name: string }>>;
  };

  expectTypeOf<FieldPath<Input>>().toEqualTypeOf<
    | "matrix"
    | "matrix[]"
    | "matrix[][]"
    | "teams"
    | "teams[]"
    | "teams[][]"
    | "teams[][].name"
  >();
  expectTypeOf<PathValue<Input, "matrix[][]">>().toEqualTypeOf<string>();
  expectTypeOf<PathValue<Input, "teams[][].name">>().toEqualTypeOf<string>();
});

it("excludes property names that cannot be encoded as form paths", () => {
  type Input = {
    "": string;
    "has.dot": string;
    "has[bracket]": string;
    "has'quote": string;
    'has"quote': string;
    "0": string;
    "01": string;
    "1e2": string;
    "0x10": string;
    " Infinity ": string;
    " ": string;
    $ACTION_ID: string;
    __formadapter_array: string;
    __formadapter_boolean: string;
    __formadapter_value: string;
    __formadapter_custom: string;
    __defineGetter__: string;
    __defineSetter__: string;
    __lookupGetter__: string;
    __lookupSetter__: string;
    __proto__: string;
    constructor: string;
    hasOwnProperty: string;
    isPrototypeOf: string;
    ok: string;
    propertyIsEnumerable: string;
    prototype: string;
    root: string;
    toLocaleString: string;
    toString: string;
    valueOf: string;
  };

  expectTypeOf<FieldPath<Input>>().toEqualTypeOf<"ok">();
});
