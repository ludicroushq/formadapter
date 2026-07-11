import { describe, expect, it } from "vitest";

import type {
  FormNode,
  ResolvedFieldConfig,
  ScalarField,
} from "@formadapter/core";

import {
  defaultValueForNode,
  errorMessage,
  firstFocusablePath,
  mergeDefaultValues,
  normalizeControlValue,
  prepareValuesForValidation,
  resolvePresentation,
} from "../src/runtime-utils";

const config: ResolvedFieldConfig<string, unknown> = {
  asyncValidationDebounceMs: 250,
  disabled: false,
  extensions: {},
  hidden: false,
  multiple: false,
  readOnly: false,
  requiredWhenVisible: false,
};

function scalar(
  overrides: Partial<ScalarField<string, unknown>> = {},
): ScalarField<string, unknown> {
  return {
    config,
    constraints: { multiple: false },
    control: "text",
    dataType: "string",
    key: "value",
    kind: "scalar",
    label: "Value",
    nullable: false,
    path: "value",
    required: true,
    source: { type: "string" },
    ...overrides,
  };
}

describe("React runtime utilities", () => {
  it("normalizes numeric, choice, nullable, optional, and empty values", () => {
    expect(normalizeControlValue(scalar({ dataType: "number" }), "12.5")).toBe(12.5);
    expect(normalizeControlValue(scalar({ dataType: "integer" }), "nope")).toBe("nope");
    expect(
      normalizeControlValue(
        scalar({ options: [{ label: "One", value: 1 }] }),
        "1",
      ),
    ).toBe(1);
    expect(
      normalizeControlValue(
        scalar({ options: [{ label: "One", value: 1 }] }),
        "number:1",
      ),
    ).toBe(1);
    expect(normalizeControlValue(scalar({ nullable: true }), "")).toBeNull();
    expect(normalizeControlValue(scalar({ required: false }), "")).toBe("");
    expect(normalizeControlValue(scalar(), "")).toBe("");
    expect(
      normalizeControlValue(scalar({ dataType: "number" }), ""),
    ).toBe("");
    expect(normalizeControlValue(scalar(), { rich: true })).toEqual({ rich: true });
  });

  it("does not collapse string and numeric options with the same display value", () => {
    const field = scalar({
      options: [
        { label: "String seven", value: "7" },
        { label: "Number seven", value: 7 },
      ],
    });

    expect(normalizeControlValue(field, "7")).toBe("7");
    expect(normalizeControlValue(field, 7)).toBe(7);
    expect(normalizeControlValue(field, "string:7")).toBe("7");
    expect(normalizeControlValue(field, "number:7")).toBe(7);
  });

  it("builds useful defaults for every node kind", () => {
    const enabled = scalar({
      dataType: "boolean",
      key: "enabled",
      path: "settings.enabled",
    });
    const note = scalar({ key: "note", path: "settings.note", required: false });
    const object: FormNode<string, unknown> = {
      children: [enabled, note],
      config,
      key: "settings",
      kind: "object",
      label: "Settings",
      nullable: false,
      path: "settings",
      required: true,
      source: { type: "object" },
    };
    const array: FormNode<string, unknown> = {
      config,
      item: scalar(),
      key: "items",
      kind: "array",
      label: "Items",
      nullable: false,
      path: "items",
      required: true,
      source: { type: "array" },
      uniqueItems: false,
    };
    const unsupported: FormNode<string, unknown> = {
      config,
      key: "mystery",
      kind: "unsupported",
      label: "Mystery",
      nullable: false,
      path: "mystery",
      reason: "unknown",
      required: false,
      source: true,
    };

    expect(defaultValueForNode(object)).toEqual({ enabled: false });
    expect(defaultValueForNode(array)).toEqual([]);
    expect(defaultValueForNode(unsupported)).toBeUndefined();
    expect(defaultValueForNode(scalar({ defaultValue: "ready" }))).toBe("ready");
  });

  it("merges nested defaults without merging arrays", () => {
    expect(
      mergeDefaultValues(
        { profile: { name: "Ada", role: "author" }, tags: ["one"] },
        { profile: { name: "Grace" }, tags: ["two"] },
      ),
    ).toEqual({
      profile: { name: "Grace", role: "author" },
      tags: ["two"],
    });
    expect(mergeDefaultValues({ stable: true }, null)).toEqual({ stable: true });
  });

  it("merges prototype-named defaults as data without changing prototypes", () => {
    expect(Object.prototype).not.toHaveProperty("formadapterPolluted");
    const overrides = JSON.parse(
      '{"__proto__":{"formadapterPolluted":true},"constructor":{"name":"Ada"}}',
    ) as Record<string, unknown>;

    const merged = mergeDefaultValues({ stable: true }, overrides);

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty("formadapterPolluted");
    expect(Object.prototype.hasOwnProperty.call(merged, "__proto__")).toBe(true);
    expect(merged["__proto__"]).toEqual({ formadapterPolluted: true });
    expect(merged.constructor).toEqual({ name: "Ada" });
  });

  it("removes optional blanks and normalizes required numeric blanks before validation", () => {
    const requiredNumber = scalar({
      dataType: "number",
      key: "count",
      path: "count",
    });
    const optionalText = scalar({
      key: "note",
      path: "note",
      required: false,
    });
    const root: FormNode<string, unknown> = {
      children: [requiredNumber, optionalText],
      config,
      key: "root",
      kind: "object",
      label: "Form",
      nullable: false,
      path: "",
      required: true,
      source: { type: "object" },
    };
    expect(
      prepareValuesForValidation(
        { fieldMap: { count: requiredNumber, note: optionalText }, fields: [requiredNumber, optionalText], root },
        { count: "", note: "" },
      ),
    ).toEqual({});
  });

  it("resolves dynamic presentation and safely reads errors", () => {
    const field = scalar({
      config: {
        ...config,
        disabled: (values) => Boolean((values as { locked?: boolean }).locked),
        hidden: true,
        readOnly: "invalid" as never,
      },
    });
    expect(resolvePresentation(field, { locked: true }, false)).toEqual({
      disabled: true,
      hidden: true,
      readOnly: false,
    });
    expect(resolvePresentation(scalar(), {}, true).disabled).toBe(true);
    expect(errorMessage({ message: "Broken" })).toBe("Broken");
    expect(errorMessage({ message: 42 })).toBeUndefined();
    expect(errorMessage(null)).toBeUndefined();
  });

  it("finds the first rendered, enabled scalar in groups and arrays", () => {
    const hidden = scalar({
      config: { ...config, hidden: true },
      key: "hidden",
      path: "profile.hidden",
    });
    const disabled = scalar({
      config: { ...config, disabled: true },
      key: "disabled",
      path: "profile.disabled",
    });
    const name = scalar({ key: "name", path: "profile.name" });
    const hiddenControl = scalar({
      control: "hidden",
      key: "token",
      path: "profile.token",
    });
    const readOnlySelect = scalar({
      config: { ...config, readOnly: true },
      control: "select",
      key: "plan",
      path: "profile.plan",
    });
    const profile: FormNode<string, unknown> = {
      children: [hidden, disabled, hiddenControl, readOnlySelect, name],
      config,
      key: "profile",
      kind: "object",
      label: "Profile",
      nullable: false,
      path: "profile",
      required: true,
      source: { type: "object" },
    };
    const items: FormNode<string, unknown> = {
      config,
      item: profile,
      key: "items",
      kind: "array",
      label: "Items",
      nullable: false,
      path: "items",
      required: true,
      source: { type: "array" },
      uniqueItems: false,
    };

    expect(firstFocusablePath(profile, "profile", { profile: {} }))
      .toBe("profile.name");
    expect(firstFocusablePath(name, "profile.name", {}, true)).toBeUndefined();
    expect(firstFocusablePath(hiddenControl, "profile.token", {}))
      .toBeUndefined();
    expect(firstFocusablePath(readOnlySelect, "profile.plan", {}))
      .toBeUndefined();
    expect(firstFocusablePath(name, "profile.name", {}, false, true))
      .toBe("profile.name");
    expect(firstFocusablePath(items, "items", { items: [{}] }))
      .toBe("items.0.name");
    expect(firstFocusablePath(items, "items", { items: [] })).toBeUndefined();
    expect(firstFocusablePath(items, "items")).toBe("items.0.hidden");
    expect(firstFocusablePath({
      config,
      key: "unknown",
      kind: "unsupported",
      label: "Unknown",
      nullable: false,
      path: "unknown",
      reason: "No control",
      required: false,
      source: true,
    }, "unknown", {})).toBeUndefined();
  });
});
