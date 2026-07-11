import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  compileForm,
  type FormModel,
  type ScalarField,
} from "@formadapter/core";

import {
  ARRAY_MARKER,
  BOOLEAN_MARKER,
  buildFormData,
  HiddenNodeFields,
  TypedValueField,
  VALUE_MARKER,
} from "../src/form-data-fields";

function scalar(
  model: FormModel<unknown, string>,
  path: string,
): ScalarField<string, unknown> {
  const field = model.fieldMap[path];
  if (field?.kind !== "scalar") throw new Error(`Expected ${path} to be scalar`);
  return field;
}

describe("model-driven FormData", () => {
  it("replaces model entries while preserving framework fields and typed values", () => {
    const schema = z.object({
      attachments: z.array(z.file()),
      avatar: z.file().optional(),
      created: z.string(),
      emptyTags: z.array(z.string()),
      enabled: z.boolean().optional(),
      nested: z.object({ name: z.string() }),
      tags: z.array(z.string()),
    });
    const model = compileForm(schema, {}) as FormModel<unknown, string>;
    const browser = new FormData();
    browser.append(ARRAY_MARKER, "stale");
    browser.append(BOOLEAN_MARKER, "stale");
    browser.append(VALUE_MARKER, "stale");
    browser.set("nested.name", "stale browser value");
    browser.set("unrelated", "keep me");
    browser.set("$ACTION_ID_fixture", "keep framework metadata");
    browser.set("bad..path", "keep unknown names");
    const first = new File(["a"], "a.txt", { type: "text/plain" });
    const second = new Blob(["b"], { type: "text/plain" });

    const result = buildFormData(model, {
      attachments: [first, second, new File([], "")],
      avatar: new Blob(["avatar"], { type: "image/png" }),
      created: new Date("2026-07-09T12:30:00.000Z"),
      emptyTags: [],
      enabled: false,
      nested: { name: "Ada" },
      tags: ["typed", "forms"],
    }, browser);

    expect(result).toBe(browser);
    expect(result.get("unrelated")).toBe("keep me");
    expect(result.get("$ACTION_ID_fixture")).toBe("keep framework metadata");
    expect(result.get("bad..path")).toBe("keep unknown names");
    expect(result.get("attachments.0")).toBeInstanceOf(File);
    expect(result.get("attachments.1")).toBeInstanceOf(Blob);
    expect(result.has("attachments.2")).toBe(false);
    expect(result.get("avatar")).toBeInstanceOf(Blob);
    expect(result.get("created")).toBe("string:2026-07-09T12:30:00.000Z");
    expect(result.get("enabled")).toBe("boolean:false");
    expect(result.get("nested.name")).toBe("string:Ada");
    expect(result.get("tags.0")).toBe("string:typed");
    expect(result.get("tags.1")).toBe("string:forms");
    expect(result.getAll(ARRAY_MARKER)).toEqual([
      "attachments",
      "emptyTags",
      "tags",
    ]);
    expect(result.getAll(BOOLEAN_MARKER)).toEqual(["enabled"]);
    expect(result.getAll(VALUE_MARKER)).toEqual([
      "created",
      "enabled",
      "nested.name",
      "tags.0",
      "tags.1",
    ]);
  });

  it("appends every real file from a FileList value", async () => {
    const model = compileForm(z.object({ attachment: z.file() }), {}) as FormModel<
      unknown,
      string
    >;
    const user = userEvent.setup();
    const { container } = render(<input multiple type="file" />);
    const input = container.querySelector("input");
    if (!input) throw new Error("Expected a file input");
    await user.upload(input, [
      new File(["one"], "one.txt", { type: "text/plain" }),
      new File(["two"], "two.txt", { type: "text/plain" }),
    ]);
    if (!input.files) throw new Error("Expected the browser to create a FileList");

    const result = buildFormData(
      model,
      { attachment: input.files },
      new FormData(),
    );

    expect(result.getAll("attachment").map((entry) =>
      entry instanceof File ? entry.name : entry
    )).toEqual(["one.txt", "two.txt"]);
  });

  it("renders canonical progressive-enhancement mirrors", () => {
    const model = compileForm(z.object({
      active: z.boolean(),
      attachment: z.file().optional(),
      birthday: z.string(),
      choice: z.union([z.literal(1), z.literal(false), z.null()]),
    }), {}) as FormModel<unknown, string>;
    const { container } = render(
      <>
        <HiddenNodeFields field={scalar(model, "active")} path="active" value={false} values={{}} />
        <HiddenNodeFields
          field={scalar(model, "attachment")}
          path="attachment"
          value={new File(["x"], "x.txt")}
          values={{}}
        />
        <HiddenNodeFields
          field={scalar(model, "birthday")}
          path="birthday"
          value={new Date("2026-07-09T00:00:00.000Z")}
          values={{}}
        />
        <HiddenNodeFields field={scalar(model, "choice")} path="choice" value={false} values={{}} />
        <TypedValueField path="nullable" />
        <TypedValueField path="initially-empty" />
      </>,
    );

    const inputs = [...container.querySelectorAll("input")];
    expect(inputs.filter((input) => input.name === BOOLEAN_MARKER)).toHaveLength(1);
    expect(inputs.find((input) => input.name === "active")).toBeUndefined();
    expect(inputs.find((input) => input.name === "attachment")).toBeUndefined();
    expect(inputs.find((input) => input.name === "birthday")?.value)
      .toBe("2026-07-09T00:00:00.000Z");
    expect(inputs.find((input) => input.name === "choice")?.value)
      .toBe("boolean:false");
    expect(inputs.filter((input) => input.name === VALUE_MARKER)).toHaveLength(2);
    expect(inputs.find((input) => input.name === "nullable")).toBeUndefined();
    expect(inputs.find((input) => input.name === "initially-empty")).toBeUndefined();
  });
});
