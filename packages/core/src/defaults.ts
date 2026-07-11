import type { DeepPartial } from "./path";
import { defineOwn } from "./record";
import type { FormModel, FormNode } from "./types";

function cloneDefault(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneDefault);
  if (typeof value !== "object" || value === null) return value;
  if (value instanceof Date) return new Date(value.getTime());
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, cloneDefault(child)]),
  );
}

export function defaultValueForNode(
  node: FormNode<string, unknown>,
): unknown {
  if (node.defaultValue !== undefined) return cloneDefault(node.defaultValue);
  if (!node.required) return undefined;

  switch (node.kind) {
    case "array": {
      const count = node.minItems ?? 0;
      return Array.from(
        { length: count },
        () => cloneDefault(defaultValueForNode(node.item)),
      );
    }
    case "object": {
      const value: Record<string, unknown> = {};
      for (const child of node.children) {
        const childDefault = defaultValueForNode(
          child as FormNode<string, unknown>,
        );
        if (childDefault !== undefined) defineOwn(value, child.key, childDefault);
      }
      return value;
    }
    case "scalar":
      if (node.dataType === "boolean") return false;
      if (node.dataType === "string" && node.required && !node.options) return "";
      return undefined;
    case "unsupported":
      return undefined;
  }
}

export function getDefaultValues<Input, Control extends string>(
  model: FormModel<Input, Control>,
): DeepPartial<Input> {
  const value = defaultValueForNode(
    model.root as FormNode<string, unknown>,
  );
  return (value ?? {}) as DeepPartial<Input>;
}
