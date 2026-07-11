import {
  compileForm,
  issuePath,
  isReservedFormPathSegment,
  optionForSerializedValue,
  pathToConfigPath,
  pathToName,
  prepareFormValues,
  validatePresentationRules,
} from "@formadapter/core";
import type {
  DeepPartial,
  FormModel,
  FormNode,
  FormSchema,
  InferInput,
  InferOutput,
  ScalarField,
  StandardIssue,
} from "@formadapter/core";

import type {
  ParseFormDataFailure,
  ParseFormDataResult,
  SubmissionOptions,
} from "./types";

export const FORMADAPTER_ARRAY_MARKER = "__formadapter_array";
export const FORMADAPTER_BOOLEAN_MARKER = "__formadapter_boolean";
export const FORMADAPTER_VALUE_MARKER = "__formadapter_value";

const OMIT = Symbol("formadapter.omit");
const MAX_ARRAY_INDEX = 10_000;

type ConcretePath = readonly (number | string)[];
type MutableRecord = Record<string, unknown>;

function assertFormDataFieldNames<Input, Control extends string>(
  model: FormModel<Input, Control>,
): void {
  const reserved: string[] = [];
  const visit = (node: FormNode<Control, Input>, root = false): void => {
    if (!root && isReservedFormPathSegment(node.key)) {
      reserved.push(node.path || node.key);
    }
    if (node.kind === "object") {
      for (const child of node.children) visit(child);
    } else if (node.kind === "array") {
      visit(node.item);
    }
  };
  visit(model.root, true);
  if (reserved.length === 0) return;
  const names = reserved.map((name) => JSON.stringify(name)).join(", ");
  throw new TypeError(
    `Cannot decode FormData for unrepresentable field path ${names}. ` +
      "Rename the field or use a JSON-only submission.",
  );
}

function own(container: object, key: number | string): boolean {
  return Object.prototype.hasOwnProperty.call(container, key);
}

function concretePath(name: string): ConcretePath | undefined {
  if (!name || name.startsWith("$ACTION_")) return undefined;
  const parts = name.split(".");
  const result: Array<number | string> = [];
  for (const part of parts) {
    if (/^(?:0|[1-9]\d*)$/.test(part)) {
      const index = Number(part);
      if (!Number.isSafeInteger(index) || index > MAX_ARRAY_INDEX) {
        return undefined;
      }
      result.push(index);
    } else {
      if (isReservedFormPathSegment(part)) return undefined;
      result.push(part);
    }
  }
  return result;
}

function nodeAtPath<Input, Control extends string>(
  model: FormModel<Input, Control>,
  path: ConcretePath,
): FormNode<Control, Input> | undefined {
  return model.fieldMap[pathToConfigPath(path)];
}

function createContainer(next: number | string): MutableRecord | unknown[] {
  return typeof next === "number" ? [] : {};
}

function valueAtPath(root: MutableRecord, path: ConcretePath): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (
      (typeof current !== "object" || current === null) ||
      !own(current, segment)
    ) {
      return undefined;
    }
    current = (current as MutableRecord)[segment];
  }
  return current;
}

function hasPath(root: MutableRecord, path: ConcretePath): boolean {
  let current: unknown = root;
  for (const segment of path) {
    if (
      (typeof current !== "object" || current === null) ||
      !own(current, segment)
    ) {
      return false;
    }
    current = (current as MutableRecord)[segment];
  }
  return true;
}

function setPath(
  root: MutableRecord,
  path: ConcretePath,
  value: unknown,
): void {
  let current: MutableRecord | unknown[] = root;
  for (const [position, segment] of path.entries()) {
    const last = position === path.length - 1;
    if (last) {
      (current as MutableRecord)[segment] = value;
      return;
    }

    const next = path[position + 1]!;
    const existing = (current as MutableRecord)[segment];
    const needsArray = typeof next === "number";
    const usable =
      typeof existing === "object" &&
      existing !== null &&
      (needsArray ? Array.isArray(existing) : !Array.isArray(existing));
    if (!usable) {
      (current as MutableRecord)[segment] = createContainer(next);
    }
    current = (current as MutableRecord)[segment] as MutableRecord | unknown[];
  }
}

function appendPath(
  root: MutableRecord,
  path: ConcretePath,
  value: unknown,
): void {
  const existing = valueAtPath(root, path);
  if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    setPath(root, path, [value]);
  }
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string";
}

function emptyFile(value: File): boolean {
  return value.name === "" && value.size === 0;
}

function serializedOption(value: string): unknown | typeof OMIT {
  const separator = value.indexOf(":");
  if (separator === -1) return OMIT;
  const type = value.slice(0, separator);
  const serialized = value.slice(separator + 1);
  switch (type) {
    case "boolean":
      if (serialized === "true") return true;
      if (serialized === "false") return false;
      return OMIT;
    case "null":
      return serialized === "" ? null : OMIT;
    case "number": {
      const number = Number(serialized);
      return serialized.trim() && Number.isFinite(number) ? number : OMIT;
    }
    case "string":
      return serialized;
    default:
      return OMIT;
  }
}

function hasOptions<Input, Control extends string>(
  node: ScalarField<Control, Input>,
): boolean {
  return Boolean(
    node.options ||
      node.config.options ||
      node.control === "radio" ||
      node.control === "select",
  );
}

function decodeOption<Input, Control extends string>(
  node: ScalarField<Control, Input>,
  value: string,
): unknown | typeof OMIT {
  const staticOption = node.options
    ? optionForSerializedValue(node.options, value)
    : undefined;
  if (staticOption) return staticOption.value;
  if (!hasOptions(node)) return OMIT;
  return serializedOption(value);
}

function decodeBoolean(value: string): boolean | string {
  if (value === "on" || value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return value;
}

function decodeScalar<Input, Control extends string>(
  node: ScalarField<Control, Input>,
  entry: FormDataEntryValue,
  typedValue = false,
): unknown | typeof OMIT {
  if (node.dataType === "file") {
    if (!isFile(entry)) return entry;
    if (!emptyFile(entry)) return entry;
    return node.nullable ? null : OMIT;
  }
  if (isFile(entry)) return entry;

  if (typedValue) {
    const typed = serializedOption(entry);
    if (typed !== OMIT) return typed;
  }

  const option = decodeOption(node, entry);
  if (option !== OMIT) return option;
  if (entry === "" && node.nullable) return null;

  if (node.dataType === "number" || node.dataType === "integer") {
    if (!entry.trim()) return OMIT;
    const number = Number(entry);
    return Number.isFinite(number) ? number : entry;
  }
  if (node.dataType === "boolean") return decodeBoolean(entry);
  return entry;
}

function markerPaths(formData: FormData, marker: string): ConcretePath[] {
  return formData
    .getAll(marker)
    .filter((value): value is string => typeof value === "string")
    .map(concretePath)
    .filter((path): path is ConcretePath => path !== undefined);
}

/** Model-driven decoding. This is intentionally not exported from the package. */
export function decodeFormData<Input, Control extends string>(
  model: FormModel<Input, Control>,
  formData: FormData,
): DeepPartial<Input> {
  const raw: MutableRecord = {};
  const typedPaths = new Set(
    markerPaths(formData, FORMADAPTER_VALUE_MARKER).map(pathToName),
  );

  for (const path of markerPaths(formData, FORMADAPTER_ARRAY_MARKER)) {
    if (nodeAtPath(model, path)?.kind === "array" && !hasPath(raw, path)) {
      setPath(raw, path, []);
    }
  }
  for (const path of markerPaths(formData, FORMADAPTER_BOOLEAN_MARKER)) {
    const node = nodeAtPath(model, path);
    if (
      node?.kind === "scalar" &&
      node.dataType === "boolean" &&
      !hasPath(raw, path)
    ) {
      setPath(raw, path, false);
    }
  }

  for (const [name, entry] of formData.entries()) {
    if (
      name === FORMADAPTER_ARRAY_MARKER ||
      name === FORMADAPTER_BOOLEAN_MARKER ||
      name === FORMADAPTER_VALUE_MARKER ||
      name.startsWith("$ACTION_")
    ) {
      continue;
    }
    const path = concretePath(name);
    if (!path) continue;
    const node = nodeAtPath(model, path);
    if (!node) continue;

    if (node.kind === "scalar") {
      const decoded = decodeScalar(node, entry, typedPaths.has(name));
      if (decoded !== OMIT) setPath(raw, path, decoded);
      continue;
    }

    if (node.kind === "array" && node.item.kind === "scalar") {
      const decoded = decodeScalar(node.item, entry, typedPaths.has(name));
      if (decoded !== OMIT) appendPath(raw, path, decoded);
    }
  }

  return raw as DeepPartial<Input>;
}

function issuesFailure(
  issues: readonly StandardIssue[],
): ParseFormDataFailure {
  const fieldErrors: Record<string, string[]> = Object.create(null);
  const formErrors: string[] = [];
  for (const issue of issues) {
    const path = pathToName(
      issuePath(issue).map((segment) =>
        typeof segment === "number" || typeof segment === "string"
          ? segment
          : String(segment),
      ),
    );
    if (!path) {
      formErrors.push(issue.message);
    } else {
      (fieldErrors[path] ??= []).push(issue.message);
    }
  }
  return { success: false, fieldErrors, formErrors };
}

export async function validateSubmissionValue<
  Schema extends FormSchema,
  Control extends string,
>(
  schema: Schema,
  model: FormModel<InferInput<Schema>, Control>,
  value: unknown,
): Promise<ParseFormDataResult<InferOutput<Schema>>> {
  const presentationIssues = validatePresentationRules(
    model,
    value as DeepPartial<InferInput<Schema>>,
  );
  const result = await schema["~standard"].validate(value);
  if (result.issues !== undefined) {
    const schemaIssues = result.issues.length > 0
      ? result.issues
      : [{ message: "Schema validation failed" }];
    return issuesFailure([...schemaIssues, ...presentationIssues]);
  }
  return presentationIssues.length > 0
    ? issuesFailure(presentationIssues)
    : { success: true, data: result.value };
}

export async function parseFormDataWithModel<
  Schema extends FormSchema,
  Control extends string,
>(
  schema: Schema,
  model: FormModel<InferInput<Schema>, Control>,
  formData: FormData,
): Promise<ParseFormDataResult<InferOutput<Schema>>> {
  assertFormDataFieldNames(model);
  const decoded = decodeFormData(model, formData);
  const prepared = prepareFormValues(model, decoded);
  return validateSubmissionValue(schema, model, prepared);
}

/** Decodes and validates FormData using the schema's input-side form model. */
export async function parseFormData<
  Schema extends FormSchema,
>(
  schema: Schema,
  formData: FormData,
  options: SubmissionOptions<Schema> = {},
): Promise<ParseFormDataResult<InferOutput<Schema>>> {
  const model = compileForm(schema, options.config ?? {});
  return parseFormDataWithModel(schema, model, formData);
}
