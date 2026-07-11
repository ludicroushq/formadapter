import type {
  BuiltInControl,
  FieldConfig,
  FieldDataType,
  FieldState,
  FormConfig,
  FormModel,
  FormNode,
  FormOption,
  JsonPrimitive,
  JsonSchema,
  JsonSchemaObject,
  NativeInputType,
  ResolvedFieldConfig,
  ScalarConstraints,
} from "./types";
import type { FormSchema, InferInput } from "./standard";
import { formPathSegmentError } from "./path-segment";
import {
  createNullRecord,
  defineOwn,
  hasOwn,
  ownValue,
} from "./record";

export class SchemaConversionError extends Error {
  public override readonly name = "SchemaConversionError";

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

interface CompileContext<Input, Control extends string> {
  readonly config: FormConfig<Input, Control>;
  readonly rootSchema: JsonSchemaObject;
  readonly resolvingRefs: ReadonlySet<string>;
}

interface NodeInput<Input, Control extends string> {
  readonly context: CompileContext<Input, Control>;
  readonly key: string;
  readonly labelFallback: string;
  readonly nullable?: boolean;
  readonly path: string;
  readonly required: boolean;
  readonly schema: JsonSchema;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSchemaObject(schema: unknown): schema is JsonSchemaObject {
  return typeof schema === "object" && schema !== null && !Array.isArray(schema);
}

function humanize(value: string): string {
  const words = value
    .replaceAll("[]", "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words ? words.charAt(0).toLocaleUpperCase() + words.slice(1) : "Field";
}

function pointerValue(root: JsonSchemaObject, reference: string): JsonSchema | undefined {
  if (!reference.startsWith("#/")) return undefined;
  let current: unknown = root;
  for (const encoded of reference.slice(2).split("/")) {
    const segment = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isRecord(current) || !hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return typeof current === "boolean" || isRecord(current)
    ? (current as JsonSchema)
    : undefined;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && sameValue(left[key], right[key])
    );
}

interface SchemaIntersection {
  readonly schema?: JsonSchemaObject;
  readonly error?: string;
}

const COMPOSED_KEYWORDS = new Set([
  "$defs",
  "additionalProperties",
  "allOf",
  "const",
  "default",
  "definitions",
  "deprecated",
  "description",
  "enum",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "items",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "multipleOf",
  "pattern",
  "patternProperties",
  "properties",
  "propertyNames",
  "readOnly",
  "required",
  "title",
  "type",
  "uniqueItems",
  "writeOnly",
]);

function intersectSchemaValue(left: JsonSchema, right: JsonSchema): JsonSchema {
  if (left === false || right === false) return false;
  if (left === true) return right;
  if (right === true) return left;
  return { allOf: [left, right] };
}

function mergeSchemaMap(
  left: Readonly<Record<string, JsonSchema>> | undefined,
  right: Readonly<Record<string, JsonSchema>> | undefined,
): Readonly<Record<string, JsonSchema>> | undefined {
  if (!left && !right) return undefined;
  const merged = createNullRecord<JsonSchema>();
  for (const [key, value] of Object.entries(left ?? {})) {
    defineOwn(merged, key, value);
  }
  for (const [key, value] of Object.entries(right ?? {})) {
    defineOwn(
      merged,
      key,
      hasOwn(merged, key) ? intersectSchemaValue(merged[key]!, value) : value,
    );
  }
  return merged;
}

function mergeDefinitions(
  left: Readonly<Record<string, JsonSchema>> | undefined,
  right: Readonly<Record<string, JsonSchema>> | undefined,
  keyword: "$defs" | "definitions",
): { readonly definitions?: Readonly<Record<string, JsonSchema>>; readonly error?: string } {
  if (!left && !right) return {};
  const merged = createNullRecord<JsonSchema>();
  for (const [key, value] of Object.entries(left ?? {})) defineOwn(merged, key, value);
  for (const [key, value] of Object.entries(right ?? {})) {
    if (hasOwn(merged, key) && !sameValue(merged[key], value)) {
      return { error: `Cannot safely combine conflicting ${keyword} definition “${key}”` };
    }
    defineOwn(merged, key, value);
  }
  return { definitions: merged };
}

function explicitTypes(schema: JsonSchemaObject): readonly string[] | undefined {
  if (typeof schema.type === "string") return [schema.type];
  return Array.isArray(schema.type) ? schema.type : undefined;
}

function intersectTypes(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): readonly string[] | undefined {
  if (!left) return right;
  if (!right) return left;
  const result: string[] = [];
  for (const leftType of left) {
    for (const rightType of right) {
      const intersection = leftType === rightType
        ? leftType
        : (leftType === "number" && rightType === "integer") ||
            (leftType === "integer" && rightType === "number")
          ? "integer"
          : undefined;
      if (intersection && !result.includes(intersection)) result.push(intersection);
    }
  }
  return result;
}

function constrainedValues(schema: JsonSchemaObject): readonly unknown[] | undefined {
  const hasConst = hasOwn(schema, "const");
  const enumValues = schema.enum;
  if (!hasConst) return enumValues;
  if (!enumValues) return [schema.const];
  return enumValues.some((value) => sameValue(value, schema.const))
    ? [schema.const]
    : [];
}

function intersectValues(
  left: readonly unknown[] | undefined,
  right: readonly unknown[] | undefined,
): readonly unknown[] | undefined {
  if (!left) return right;
  if (!right) return left;
  return left.filter((leftValue) =>
    right.some((rightValue) => sameValue(leftValue, rightValue))
  );
}

function valueMatchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "array": return Array.isArray(value);
    case "boolean": return typeof value === "boolean";
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "null": return value === null;
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "object": return isRecord(value);
    case "string": return typeof value === "string";
    default: return false;
  }
}

interface NumericBoundary {
  readonly exclusive: boolean;
  readonly value: number;
}

function lowerBoundary(schema: JsonSchemaObject): NumericBoundary | undefined {
  const candidates: NumericBoundary[] = [];
  if (schema.minimum !== undefined) {
    candidates.push({ exclusive: false, value: schema.minimum });
  }
  if (schema.exclusiveMinimum !== undefined) {
    candidates.push({ exclusive: true, value: schema.exclusiveMinimum });
  }
  return candidates.sort((left, right) =>
    right.value - left.value || Number(right.exclusive) - Number(left.exclusive)
  )[0];
}

function upperBoundary(schema: JsonSchemaObject): NumericBoundary | undefined {
  const candidates: NumericBoundary[] = [];
  if (schema.maximum !== undefined) {
    candidates.push({ exclusive: false, value: schema.maximum });
  }
  if (schema.exclusiveMaximum !== undefined) {
    candidates.push({ exclusive: true, value: schema.exclusiveMaximum });
  }
  return candidates.sort((left, right) =>
    left.value - right.value || Number(right.exclusive) - Number(left.exclusive)
  )[0];
}

function stricterLower(
  left: NumericBoundary | undefined,
  right: NumericBoundary | undefined,
): NumericBoundary | undefined {
  if (!left) return right;
  if (!right) return left;
  if (left.value !== right.value) return left.value > right.value ? left : right;
  return left.exclusive ? left : right;
}

function stricterUpper(
  left: NumericBoundary | undefined,
  right: NumericBoundary | undefined,
): NumericBoundary | undefined {
  if (!left) return right;
  if (!right) return left;
  if (left.value !== right.value) return left.value < right.value ? left : right;
  return left.exclusive ? left : right;
}

function stricterMultipleOf(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) return right;
  if (right === undefined || Object.is(left, right)) return left;
  if (left > 0 && right > 0) {
    const leftRatio = left / right;
    if (Number.isInteger(leftRatio)) return left;
    const rightRatio = right / left;
    if (Number.isInteger(rightRatio)) return right;
  }
  return undefined;
}

function mergeSchema(left: JsonSchemaObject, right: JsonSchemaObject): SchemaIntersection {
  for (const key of Object.keys(left)) {
    if (
      hasOwn(right, key) &&
      !COMPOSED_KEYWORDS.has(key) &&
      !key.startsWith("x-formadapter") &&
      !sameValue(left[key], right[key])
    ) {
      return { error: `Cannot safely combine conflicting allOf keyword “${key}”` };
    }
  }

  const types = intersectTypes(explicitTypes(left), explicitTypes(right));
  if (types?.length === 0) {
    return { error: "The allOf branches require incompatible JSON Schema types" };
  }

  let values = intersectValues(constrainedValues(left), constrainedValues(right));
  if (values && types) {
    values = values.filter((value) => types.some((type) => valueMatchesType(value, type)));
  }
  if (values?.length === 0) {
    return { error: "The allOf branches have no allowed values in common" };
  }

  if (
    left.pattern !== undefined &&
    right.pattern !== undefined &&
    left.pattern !== right.pattern
  ) {
    return { error: "Multiple different patterns in allOf cannot be represented by one form control" };
  }
  if (
    left.format !== undefined &&
    right.format !== undefined &&
    left.format !== right.format
  ) {
    return { error: "Conflicting formats in allOf cannot be represented by one form control" };
  }

  const multipleOf = stricterMultipleOf(left.multipleOf, right.multipleOf);
  if (
    left.multipleOf !== undefined &&
    right.multipleOf !== undefined &&
    multipleOf === undefined
  ) {
    return { error: "Different multipleOf constraints in allOf cannot be represented safely" };
  }

  const minimum = stricterLower(lowerBoundary(left), lowerBoundary(right));
  const maximum = stricterUpper(upperBoundary(left), upperBoundary(right));
  if (
    minimum &&
    maximum &&
    (minimum.value > maximum.value ||
      (minimum.value === maximum.value && (minimum.exclusive || maximum.exclusive)))
  ) {
    return { error: "The allOf numeric constraints cannot be satisfied" };
  }

  const minLength = Math.max(left.minLength ?? 0, right.minLength ?? 0);
  const maxLength = Math.min(left.maxLength ?? Number.POSITIVE_INFINITY, right.maxLength ?? Number.POSITIVE_INFINITY);
  if (minLength > maxLength) {
    return { error: "The allOf string-length constraints cannot be satisfied" };
  }
  const minItems = Math.max(left.minItems ?? 0, right.minItems ?? 0);
  const maxItems = Math.min(left.maxItems ?? Number.POSITIVE_INFINITY, right.maxItems ?? Number.POSITIVE_INFINITY);
  if (minItems > maxItems) {
    return { error: "The allOf array-length constraints cannot be satisfied" };
  }

  const definitions = mergeDefinitions(left.definitions, right.definitions, "definitions");
  if (definitions.error) return { error: definitions.error };
  const defs = mergeDefinitions(left.$defs, right.$defs, "$defs");
  if (defs.error) return { error: defs.error };

  const leftProperties = new Set(Object.keys(left.properties ?? {}));
  const rightProperties = new Set(Object.keys(right.properties ?? {}));
  if (
    (left.additionalProperties === false &&
      [...rightProperties].some((key) => !leftProperties.has(key))) ||
    (right.additionalProperties === false &&
      [...leftProperties].some((key) => !rightProperties.has(key)))
  ) {
    return {
      error: "Closed object branches in allOf declare incompatible property sets",
    };
  }

  const merged = { ...left, ...right } as Record<string, unknown>;
  delete merged.type;
  if (types) merged.type = types.length === 1 ? types[0] : types;

  delete merged.const;
  delete merged.enum;
  if (values) {
    const usesConst = hasOwn(left, "const") || hasOwn(right, "const");
    if (usesConst && values.length === 1) merged.const = values[0];
    else merged.enum = values;
  }

  const properties = mergeSchemaMap(left.properties, right.properties);
  if (properties) merged.properties = properties;
  const patternProperties = mergeSchemaMap(left.patternProperties, right.patternProperties);
  if (patternProperties) merged.patternProperties = patternProperties;
  if (left.required || right.required) {
    merged.required = [...new Set([...(left.required ?? []), ...(right.required ?? [])])];
  }

  if (hasOwn(left, "additionalProperties") && hasOwn(right, "additionalProperties")) {
    merged.additionalProperties = intersectSchemaValue(
      left.additionalProperties!,
      right.additionalProperties!,
    );
  }
  if (hasOwn(left, "propertyNames") && hasOwn(right, "propertyNames")) {
    merged.propertyNames = intersectSchemaValue(left.propertyNames!, right.propertyNames!);
  }
  if (hasOwn(left, "items") && hasOwn(right, "items")) {
    if (Array.isArray(left.items) || Array.isArray(right.items)) {
      if (!sameValue(left.items, right.items)) {
        return { error: "Different tuple item schemas in allOf cannot be represented safely" };
      }
    } else {
      merged.items = intersectSchemaValue(
        left.items as JsonSchema,
        right.items as JsonSchema,
      );
    }
  }

  const allOf = [...(left.allOf ?? []), ...(right.allOf ?? [])];
  if (allOf.length > 0) merged.allOf = allOf;
  else delete merged.allOf;

  delete merged.minimum;
  delete merged.exclusiveMinimum;
  if (minimum) merged[minimum.exclusive ? "exclusiveMinimum" : "minimum"] = minimum.value;
  delete merged.maximum;
  delete merged.exclusiveMaximum;
  if (maximum) merged[maximum.exclusive ? "exclusiveMaximum" : "maximum"] = maximum.value;

  delete merged.minLength;
  delete merged.maxLength;
  if (left.minLength !== undefined || right.minLength !== undefined) merged.minLength = minLength;
  if (maxLength !== Number.POSITIVE_INFINITY) merged.maxLength = maxLength;
  delete merged.minItems;
  delete merged.maxItems;
  if (left.minItems !== undefined || right.minItems !== undefined) merged.minItems = minItems;
  if (maxItems !== Number.POSITIVE_INFINITY) merged.maxItems = maxItems;
  if (multipleOf !== undefined) merged.multipleOf = multipleOf;

  if (left.uniqueItems !== undefined || right.uniqueItems !== undefined) {
    merged.uniqueItems = left.uniqueItems === true || right.uniqueItems === true;
  }
  if (left.readOnly !== undefined || right.readOnly !== undefined) {
    merged.readOnly = left.readOnly === true || right.readOnly === true;
  }
  if (hasOwn(left, "writeOnly") || hasOwn(right, "writeOnly")) {
    merged.writeOnly = left.writeOnly === true || right.writeOnly === true;
  }
  if (definitions.definitions) merged.definitions = definitions.definitions;
  if (defs.definitions) merged.$defs = defs.definitions;

  return { schema: merged as JsonSchemaObject };
}

function schemaChildren(schema: JsonSchemaObject): readonly JsonSchema[] {
  const children: JsonSchema[] = [];
  children.push(...Object.values(schema.properties ?? {}));
  children.push(...Object.values(schema.patternProperties ?? {}));
  for (const keyword of ["additionalProperties", "propertyNames"] as const) {
    const child = schema[keyword];
    if (typeof child === "boolean" || isSchemaObject(child)) children.push(child);
  }
  if (Array.isArray(schema.items)) children.push(...schema.items);
  else if (typeof schema.items === "boolean" || isSchemaObject(schema.items)) children.push(schema.items);
  children.push(...(schema.prefixItems ?? []));
  children.push(...(schema.allOf ?? []), ...(schema.anyOf ?? []), ...(schema.oneOf ?? []));
  return children;
}

function referenceIsRecursive(
  root: JsonSchemaObject,
  reference: string,
): boolean {
  const target = pointerValue(root, reference);
  if (target === undefined) return false;
  const visitedObjects = new Set<JsonSchemaObject>();
  const visitedReferences = new Set<string>();
  const visit = (schema: JsonSchema): boolean => {
    if (!isSchemaObject(schema)) return false;
    if (schema.$ref) {
      if (schema.$ref === reference) return true;
      if (visitedReferences.has(schema.$ref)) return false;
      visitedReferences.add(schema.$ref);
      const nested = pointerValue(root, schema.$ref);
      if (nested !== undefined && visit(nested)) return true;
    }
    if (visitedObjects.has(schema)) return false;
    visitedObjects.add(schema);
    return schemaChildren(schema).some(visit);
  };
  return visit(target);
}

function resolveSchema<Input, Control extends string>(
  schema: JsonSchema,
  context: CompileContext<Input, Control>,
): { schema: JsonSchema; context: CompileContext<Input, Control>; error?: string } {
  if (!isSchemaObject(schema) || !schema.$ref) return { schema, context };
  const reference = schema.$ref;
  if (context.resolvingRefs.has(reference) && referenceIsRecursive(context.rootSchema, reference)) {
    return { schema, context, error: `Circular JSON Schema reference “${reference}”` };
  }
  const target = pointerValue(context.rootSchema, reference);
  if (target === undefined) {
    return { schema, context, error: `Unresolved JSON Schema reference “${reference}”` };
  }
  const nextContext: CompileContext<Input, Control> = {
    ...context,
    resolvingRefs: new Set([...context.resolvingRefs, reference]),
  };
  const { $ref: _ignored, ...siblings } = schema;
  if (target === false) return { schema: false, context: nextContext };
  if (target === true) {
    return Object.keys(siblings).length === 0
      ? { schema: true, context: nextContext }
      : { schema: siblings, context: nextContext };
  }
  const resolvedTarget = target.$ref
    ? resolveSchema(target, nextContext)
    : { schema: target as JsonSchema, context: nextContext };
  if (resolvedTarget.error || resolvedTarget.schema === false) return resolvedTarget;
  if (resolvedTarget.schema === true) {
    return Object.keys(siblings).length === 0
      ? resolvedTarget
      : { schema: siblings, context: resolvedTarget.context };
  }
  if (Object.keys(siblings).length === 0) return resolvedTarget;
  const merged = mergeSchema(resolvedTarget.schema, siblings);
  return merged.error
    ? { schema, context, error: merged.error }
    : { schema: merged.schema!, context: resolvedTarget.context };
}

function collapseAllOf<Input, Control extends string>(
  schema: JsonSchemaObject,
  context: CompileContext<Input, Control>,
): {
  schema: JsonSchemaObject;
  context: CompileContext<Input, Control>;
  error?: string;
} {
  if (!schema.allOf || schema.allOf.length === 0) return { schema, context };
  const { allOf, ...base } = schema;
  let merged = base;
  const resolvingRefs = new Set(context.resolvingRefs);

  for (const branch of allOf) {
    const resolved = resolveSchema(branch, context);
    if (resolved.error) return { schema: merged, context, error: resolved.error };
    if (resolved.schema === false) {
      return {
        schema: merged,
        context,
        error: "An allOf branch can never be valid",
      };
    }
    if (resolved.schema === true) continue;

    const collapsed = collapseAllOf(resolved.schema, resolved.context);
    if (collapsed.error) return collapsed;
    const intersection = mergeSchema(merged, collapsed.schema);
    if (intersection.error) {
      return { schema: merged, context, error: intersection.error };
    }
    merged = intersection.schema!;
    for (const reference of collapsed.context.resolvingRefs) {
      resolvingRefs.add(reference);
    }
  }

  return {
    schema: merged,
    context: { ...context, resolvingRefs },
  };
}

function primitive(value: unknown): value is JsonPrimitive {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function optionsFromSchema(schema: JsonSchemaObject): readonly FormOption[] | undefined {
  const raw = schema.enum ?? (schema.const !== undefined ? [schema.const] : undefined);
  if (!raw || !raw.every(primitive)) return undefined;
  return raw.map((value) => ({ label: humanize(String(value)), value }));
}

function optionsFromUnion<Input, Control extends string>(
  branches: readonly JsonSchema[],
  context: CompileContext<Input, Control>,
  exclusive: boolean,
): readonly FormOption[] | undefined {
  const options: FormOption[] = [];
  for (const branch of branches) {
    const resolved = resolveSchema(branch, context);
    if (resolved.error || resolved.schema === true) return undefined;
    if (resolved.schema === false) continue;
    const collapsed = collapseAllOf(resolved.schema, resolved.context);
    if (collapsed.error) return undefined;
    const branchOptions = optionsFromSchema(collapsed.schema);
    if (!branchOptions) return undefined;
    for (const option of branchOptions) {
      const duplicate = options.some((existing) => Object.is(existing.value, option.value));
      if (duplicate) {
        if (exclusive) return undefined;
        continue;
      }
      options.push({
        label: collapsed.schema.title ?? option.label,
        value: option.value,
      });
    }
  }
  return options;
}

function mediaTypesFromUnion<Input, Control extends string>(
  branches: readonly JsonSchema[],
  context: CompileContext<Input, Control>,
): readonly string[] | undefined {
  const mediaTypes: string[] = [];
  for (const branch of branches) {
    const resolved = resolveSchema(branch, context);
    if (resolved.error || !isSchemaObject(resolved.schema)) return undefined;
    const collapsed = collapseAllOf(resolved.schema, resolved.context);
    if (collapsed.error || typeof collapsed.schema.contentMediaType !== "string") {
      return undefined;
    }
    const unsupportedKeyword = Object.keys(collapsed.schema).find((key) =>
      ![
        "$comment",
        "contentMediaType",
        "deprecated",
        "description",
        "readOnly",
        "title",
        "writeOnly",
      ].includes(key)
    );
    if (unsupportedKeyword) return undefined;
    if (!mediaTypes.includes(collapsed.schema.contentMediaType)) {
      mediaTypes.push(collapsed.schema.contentMediaType);
    }
  }
  return mediaTypes.length > 0 ? mediaTypes : undefined;
}

interface ObjectUnionRule {
  readonly visibleFor: readonly JsonPrimitive[];
  readonly requiredFor: readonly JsonPrimitive[];
}

interface NormalizedObjectUnion {
  readonly discriminator: string;
  readonly rules: Readonly<Record<string, ObjectUnionRule>>;
  readonly schema: JsonSchemaObject;
}

function sameSchema(left: JsonSchema, right: JsonSchema): boolean {
  return sameValue(left, right);
}

function normalizedObjectUnion<Input, Control extends string>(
  branches: readonly JsonSchema[],
  context: CompileContext<Input, Control>,
): NormalizedObjectUnion | undefined {
  const objects: JsonSchemaObject[] = [];
  for (const branch of branches) {
    const resolved = resolveSchema(branch, context);
    if (resolved.error || !isSchemaObject(resolved.schema)) return undefined;
    const collapsed = collapseAllOf(resolved.schema, resolved.context);
    if (collapsed.error || !schemaTypes(collapsed.schema).includes("object")) {
      return undefined;
    }
    objects.push(collapsed.schema);
  }
  if (objects.length < 2) return undefined;

  const commonKeys = Object.keys(objects[0]?.properties ?? {}).filter((key) =>
    objects.every((branch) => hasOwn(branch.properties ?? {}, key))
  );
  const discriminator = commonKeys.find((key) => {
    const values = objects.map((branch) => {
      const property = branch.properties?.[key];
      if (property === undefined || !isSchemaObject(property)) return undefined;
      const options = optionsFromSchema(property);
      return options?.length === 1 ? options[0]?.value : undefined;
    });
    return values.every((value) => value !== undefined) &&
      new Set(values.map((value) => JSON.stringify(value))).size === values.length;
  });
  if (!discriminator) return undefined;

  const discriminatorValues = objects.map((branch) => {
    const property = branch.properties?.[discriminator];
    return optionsFromSchema(property as JsonSchemaObject)?.[0]?.value;
  }) as JsonPrimitive[];
  const propertyNames = [...new Set(
    objects.flatMap((branch) => Object.keys(branch.properties ?? {})),
  )];
  const properties = createNullRecord<JsonSchema>();
  const rules = createNullRecord<ObjectUnionRule>();

  for (const propertyName of propertyNames) {
    const schemas = objects.flatMap((branch) => {
      const property = branch.properties?.[propertyName];
      return property === undefined ? [] : [property];
    });
    if (propertyName === discriminator) {
      const initial = schemas[0];
      const first: JsonSchemaObject = initial !== undefined && isSchemaObject(initial)
        ? initial
        : {};
      const { const: _const, ...withoutConst } = first;
      defineOwn(properties, propertyName, {
        ...withoutConst,
        enum: discriminatorValues,
      });
    } else {
      const first = schemas[0]!;
      defineOwn(
        properties,
        propertyName,
        schemas.every((candidate) => sameSchema(first, candidate))
          ? first
          : { anyOf: schemas },
      );
    }

    const visibleFor: JsonPrimitive[] = [];
    const requiredFor: JsonPrimitive[] = [];
    for (const [index, branch] of objects.entries()) {
      if (branch.properties?.[propertyName] !== undefined) {
        visibleFor.push(discriminatorValues[index]!);
      }
      if (branch.required?.includes(propertyName)) {
        requiredFor.push(discriminatorValues[index]!);
      }
    }
    defineOwn(rules, propertyName, { requiredFor, visibleFor });
  }

  const required = propertyNames.filter((propertyName) =>
    objects.every((branch) => branch.required?.includes(propertyName))
  );
  return {
    discriminator,
    rules,
    schema: {
      properties,
      required,
      type: "object",
    },
  };
}

function runtimePathValue(values: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    return isRecord(current) ? ownValue(current, segment) : undefined;
  }, values);
}

function stateValue<Values>(state: FieldState<Values>, values: Values): boolean {
  return typeof state === "function"
    ? state(values as Readonly<import("./path").DeepPartial<Values>>)
    : state;
}

function extensionConfig(schema: JsonSchemaObject): Readonly<Record<string, unknown>> {
  const nested = isRecord(schema["x-formadapter"])
    ? schema["x-formadapter"]
    : {};
  const flat = createNullRecord<unknown>();
  const prefix = "x-formadapter-";
  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith(prefix)) defineOwn(flat, key.slice(prefix.length), value);
  }
  return { ...nested, ...flat };
}

function fieldOverride<Input, Control extends string>(
  path: string,
  config: FormConfig<Input, Control>,
): FieldConfig<Control, Input> | undefined {
  const fields = config.fields as
    | Readonly<Record<string, FieldConfig<Control, Input> | undefined>>
    | undefined;
  return fields && hasOwn(fields, path) ? fields[path] : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function resolvedConfig<Input, Control extends string>(
  schema: JsonSchemaObject,
  override: FieldConfig<Control, Input> | undefined,
): ResolvedFieldConfig<Control, Input> {
  const extensions = extensionConfig(schema);
  const control = override?.control ?? stringValue(extensions.control);
  const placeholder = override?.placeholder ?? stringValue(extensions.placeholder);
  const order = override?.order ?? numberValue(extensions.order);
  const className =
    override?.className ??
    stringValue(extensions.className ?? extensions["class-name"]);
  return {
    ...(control !== undefined
      ? { control: control as BuiltInControl | Control }
      : {}),
    ...(placeholder !== undefined ? { placeholder } : {}),
    hidden: override?.hidden ?? booleanValue(extensions.hidden) ?? false,
    disabled: override?.disabled ?? booleanValue(extensions.disabled) ?? false,
    readOnly:
      override?.readOnly ??
      booleanValue(extensions.readonly ?? extensions.readOnly) ??
      schema.readOnly ??
      false,
    ...(order !== undefined ? { order } : {}),
    ...(className !== undefined ? { className } : {}),
    ...(override?.controlProps ? { controlProps: override.controlProps } : {}),
    multiple: override?.multiple ?? booleanValue(extensions.multiple) ?? false,
    ...(override?.options ? { options: override.options } : {}),
    requiredWhenVisible:
      override?.requiredWhenVisible ??
      booleanValue(extensions.requiredWhenVisible ?? extensions["required-when-visible"]) ??
      false,
    ...(override?.requiredMessage ? { requiredMessage: override.requiredMessage } : {}),
    ...(override?.asyncValidate !== undefined
      ? { asyncValidate: override.asyncValidate as NonNullable<ResolvedFieldConfig<Control, Input>["asyncValidate"]> }
      : {}),
    asyncValidationDebounceMs: Math.max(
      0,
      override?.asyncValidationDebounceMs ?? 250,
    ),
    ...(override?.array ? { array: override.array } : {}),
    extensions,
  };
}

function schemaTypes(schema: JsonSchemaObject): readonly string[] {
  if (typeof schema.type === "string") return [schema.type];
  if (Array.isArray(schema.type)) {
    const types = [...new Set(schema.type)];
    return types.includes("number")
      ? types.filter((type) => type !== "integer")
      : types;
  }
  if (schema.properties) return ["object"];
  if (schema.items) return ["array"];
  if (schema.const !== undefined) {
    if (schema.const === null) return ["null"];
    return [typeof schema.const];
  }
  if (schema.enum?.length) {
    return [...new Set(schema.enum.map((value) => (value === null ? "null" : typeof value)))];
  }
  return [];
}

function inferControl(
  dataType: FieldDataType,
  schema: JsonSchemaObject,
  options: readonly FormOption[] | undefined,
): BuiltInControl {
  if (dataType === "boolean") return "checkbox";
  if (options !== undefined) return "select";
  if (dataType === "number" || dataType === "integer") return "number";
  if (dataType === "file") return "file";
  switch (schema.format) {
    case "date": return "date";
    // RFC 3339 date-times include offset semantics that datetime-local drops.
    // Consumers can explicitly opt into datetime-local when they own conversion.
    case "date-time": return "text";
    case "email": return "email";
    case "password": return "password";
    case "tel": return "tel";
    case "time": return "time";
    case "uri":
    case "url": return "url";
    default: return "text";
  }
}

const NATIVE_INPUT_TYPES = new Set<NativeInputType>([
  "checkbox",
  "date",
  "datetime-local",
  "email",
  "file",
  "hidden",
  "number",
  "password",
  "range",
  "search",
  "tel",
  "text",
  "time",
  "url",
]);

function inputType(control: string): NativeInputType | undefined {
  return NATIVE_INPUT_TYPES.has(control as NativeInputType)
    ? control as NativeInputType
    : undefined;
}

function constraints(
  schema: JsonSchemaObject,
  config: ResolvedFieldConfig<string, unknown>,
  acceptedMediaTypes?: readonly string[],
): ScalarConstraints {
  return {
    ...(schema.format ? { format: schema.format } : {}),
    ...(schema.minLength !== undefined ? { minLength: schema.minLength } : {}),
    ...(schema.maxLength !== undefined ? { maxLength: schema.maxLength } : {}),
    ...(schema.pattern ? { pattern: schema.pattern } : {}),
    ...(schema.minimum !== undefined ? { minimum: schema.minimum } : {}),
    ...(schema.maximum !== undefined ? { maximum: schema.maximum } : {}),
    ...(schema.exclusiveMinimum !== undefined
      ? { exclusiveMinimum: schema.exclusiveMinimum }
      : {}),
    ...(schema.exclusiveMaximum !== undefined
      ? { exclusiveMaximum: schema.exclusiveMaximum }
      : {}),
    ...(schema.multipleOf !== undefined ? { multipleOf: schema.multipleOf } : {}),
    ...(acceptedMediaTypes?.length
      ? { accept: acceptedMediaTypes.join(",") }
      : schema.contentMediaType
        ? { accept: schema.contentMediaType }
        : {}),
    multiple: config.multiple,
    ...(schema.contentEncoding ? { contentEncoding: schema.contentEncoding } : {}),
    ...(schema.contentMediaType ? { contentMediaType: schema.contentMediaType } : {}),
  };
}

function isFileSchema(schema: JsonSchemaObject): boolean {
  return schema.format === "binary" ||
    schema.contentEncoding === "binary" ||
    schema.contentMediaType !== undefined;
}

function nonNullUnionBranch<Input, Control extends string>(
  branch: JsonSchema,
  context: CompileContext<Input, Control>,
): { readonly branch?: JsonSchema; readonly nullable: boolean } {
  const resolved = resolveSchema(branch, context);
  if (resolved.error) return { branch, nullable: false };
  if (resolved.schema === false) return { nullable: false };
  if (resolved.schema === true) return { branch: true, nullable: false };
  const collapsed = collapseAllOf(resolved.schema, resolved.context);
  if (collapsed.error) return { branch, nullable: false };
  const schema = collapsed.schema;
  const types = schemaTypes(schema);
  if (!types.includes("null")) return { branch, nullable: false };

  const nonNullTypes = types.filter((type) => type !== "null");
  if (nonNullTypes.length === 0) return { nullable: true };
  if (Array.isArray(schema.type)) {
    return {
      branch: {
        ...schema,
        type: schema.type.filter((type) => type !== "null"),
      },
      nullable: true,
    };
  }
  if (schema.enum) {
    return {
      branch: {
        ...schema,
        enum: schema.enum.filter((value) => value !== null),
      },
      nullable: true,
    };
  }
  return { branch, nullable: true };
}

function unsupported<Input, Control extends string>(
  input: NodeInput<Input, Control>,
  schema: JsonSchema,
  reason: string,
): FormNode<Control, Input> {
  const objectSchema = isSchemaObject(schema) ? schema : {};
  const override = fieldOverride(input.path, input.context.config);
  return {
    kind: "unsupported",
    key: input.key,
    path: input.path,
    label: override?.label ?? objectSchema.title ?? input.labelFallback,
    ...(override?.description ?? objectSchema.description
      ? { description: override?.description ?? objectSchema.description }
      : {}),
    required: input.required,
    nullable: input.nullable ?? false,
    ...(override?.defaultValue ?? objectSchema.default !== undefined
      ? { defaultValue: override?.defaultValue ?? objectSchema.default }
      : {}),
    config: resolvedConfig(objectSchema, override),
    source: schema,
    reason,
  };
}

function compileNode<Input, Control extends string>(
  input: NodeInput<Input, Control>,
): FormNode<Control, Input> {
  const resolved = resolveSchema(input.schema, input.context);
  if (resolved.error) return unsupported(input, input.schema, resolved.error);
  if (resolved.schema === false) return unsupported(input, false, "This field can never be valid");
  if (resolved.schema === true) return unsupported(input, true, "The schema does not describe a renderable field");

  const collapsed = collapseAllOf(resolved.schema, resolved.context);
  if (collapsed.error) {
    return unsupported(input, resolved.schema, collapsed.error);
  }
  let schema = collapsed.schema;
  const nodeContext = collapsed.context;
  if (schema.enum?.length === 0) {
    return unsupported(input, schema, "An empty enum can never be valid");
  }
  if (Array.isArray(schema.type) && schema.type.length === 0) {
    return unsupported(input, schema, "An empty type union can never be valid");
  }
  const union = schema.oneOf ?? schema.anyOf;
  let nullable = input.nullable ?? false;
  let unionOptions: readonly FormOption[] | undefined;
  let objectUnion: NormalizedObjectUnion | undefined;
  let acceptedMediaTypes: readonly string[] | undefined;
  if (union) {
    if (union.length === 0) {
      return unsupported(input, schema, "An empty union can never be valid");
    }
    const classified = union.map((branch) => nonNullUnionBranch(branch, nodeContext));
    const nonNull = classified.flatMap((entry) =>
      entry.branch === undefined ? [] : [entry.branch]
    );
    nullable ||= classified.some((entry) => entry.nullable);
    acceptedMediaTypes = isFileSchema(schema) && schema.anyOf !== undefined
      ? mediaTypesFromUnion(nonNull, nodeContext)
      : undefined;
    objectUnion = acceptedMediaTypes
      ? undefined
      : normalizedObjectUnion(nonNull, nodeContext);
    if (acceptedMediaTypes) {
      const { oneOf: _one, anyOf: _any, ...withoutUnion } = schema;
      schema = withoutUnion;
    } else if (objectUnion) {
      if (input.path.includes("[]")) {
        return unsupported(
          input,
          schema,
          "Discriminated object unions inside arrays are not supported yet",
        );
      }
      const { oneOf: _one, anyOf: _any, ...withoutUnion } = schema;
      const intersection = mergeSchema(withoutUnion, objectUnion.schema);
      if (intersection.error) return unsupported(input, schema, intersection.error);
      schema = intersection.schema!;
    } else if (nonNull.length === 1 && isSchemaObject(nonNull[0]!)) {
      const { oneOf: _one, anyOf: _any, ...withoutUnion } = schema;
      const resolvedBranch = resolveSchema(nonNull[0]!, nodeContext);
      if (resolvedBranch.error) return unsupported(input, schema, resolvedBranch.error);
      if (resolvedBranch.schema === false) {
        return unsupported(input, schema, "This union cannot be valid");
      }
      if (resolvedBranch.schema === true) {
        return unsupported(input, schema, "An unconstrained union cannot be represented as one form control");
      }
      const collapsedBranch = collapseAllOf(resolvedBranch.schema, resolvedBranch.context);
      if (collapsedBranch.error) return unsupported(input, schema, collapsedBranch.error);
      const intersection = mergeSchema(withoutUnion, collapsedBranch.schema);
      if (intersection.error) return unsupported(input, schema, intersection.error);
      schema = intersection.schema!;
    } else {
      unionOptions = optionsFromUnion(nonNull, nodeContext, schema.oneOf !== undefined);
      if (!unionOptions || unionOptions.length === 0) {
        return unsupported(input, schema, "This union cannot be represented as one form control");
      }
      const { oneOf: _one, anyOf: _any, ...withoutUnion } = schema;
      schema = {
        ...withoutUnion,
        enum: unionOptions.map((option) => option.value),
      };
    }
  }

  const types = schemaTypes(schema).filter((type) => type !== "null");
  nullable ||= schemaTypes(schema).includes("null");
  const type = types.length === 1 ? types[0] : undefined;
  const override = fieldOverride(input.path, input.context.config);
  const extensions = extensionConfig(schema);
  const label =
    override?.label ??
    schema.title ??
    stringValue(extensions.label) ??
    input.labelFallback;
  const description = override?.description ?? schema.description ?? stringValue(extensions.description);
  const defaultValue = override?.defaultValue ?? schema.default;
  const config = resolvedConfig(schema, override);
  const common = {
    key: input.key,
    path: input.path,
    label,
    ...(description ? { description } : {}),
    required: input.required,
    nullable,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    config,
    source: schema,
  };

  if (type === "object") {
    const hasProperties = Object.keys(schema.properties ?? {}).length > 0;
    const hasDynamicProperties =
      schema.additionalProperties === true ||
      isSchemaObject(schema.additionalProperties ?? false) ||
      Object.keys(schema.patternProperties ?? {}).length > 0 ||
      (!hasProperties && schema.propertyNames !== undefined);
    if (hasDynamicProperties) {
      return unsupported(
        input,
        schema,
        "Dynamic record keys are not supported yet",
      );
    }
    const required = new Set(schema.required ?? []);
    const children = Object.entries(schema.properties ?? {}).map(([key, child]) => {
      const path = input.path ? `${input.path}.${key}` : key;
      const childInput = {
        context: nodeContext,
        key,
        labelFallback: humanize(key),
        path,
        required: required.has(key),
        schema: child,
      } satisfies NodeInput<Input, Control>;
      const invalidPath = formPathSegmentError(key);
      const compiled = invalidPath
        ? unsupported(childInput, child, invalidPath)
        : compileNode(childInput);
      const unionInfo = objectUnion;
      const rule = unionInfo?.rules[key];
      if (!unionInfo || !rule || path.includes("[]")) return compiled;
      const discriminatorPath = input.path
        ? `${input.path}.${unionInfo.discriminator}`
        : unionInfo.discriminator;
      const existingHidden = compiled.config.hidden;
      const existingRequired = compiled.config.requiredWhenVisible;
      return {
        ...compiled,
        config: {
          ...compiled.config,
          hidden: (values: Readonly<import("./path").DeepPartial<Input>>) => {
            const selected = runtimePathValue(values, discriminatorPath);
            const branchCount = unionInfo.rules[unionInfo.discriminator]?.visibleFor.length ?? 0;
            const branchHidden = rule.visibleFor.length < branchCount &&
              !rule.visibleFor.some((value) => Object.is(value, selected));
            return stateValue(existingHidden, values as Input) || branchHidden;
          },
          requiredWhenVisible: (
            values: Readonly<import("./path").DeepPartial<Input>>,
          ) => {
            const selected = runtimePathValue(values, discriminatorPath);
            const branchRequired = rule.requiredFor.some((value) => Object.is(value, selected));
            return stateValue(existingRequired, values as Input) || branchRequired;
          },
        },
      };
    }).sort((left, right) => {
      return (left.config.order ?? Number.MAX_SAFE_INTEGER) -
        (right.config.order ?? Number.MAX_SAFE_INTEGER);
    });
    return { kind: "object", ...common, children };
  }

  if (type === "array") {
    const itemSchema = schema.items;
    if (Array.isArray(itemSchema) || schema.prefixItems) {
      return unsupported(input, schema, "Tuple schemas are not supported yet");
    }
    if (!itemSchema) return unsupported(input, schema, "Array schema is missing its item schema");
    const itemPath = `${input.path}[]`;
    const item = compileNode({
      context: nodeContext,
      key: input.key,
      labelFallback: `${label} item`,
      path: itemPath,
      required: true,
      schema: itemSchema as JsonSchema,
    });
    return {
      kind: "array",
      ...common,
      item,
      ...(schema.minItems !== undefined ? { minItems: schema.minItems } : {}),
      ...(schema.maxItems !== undefined ? { maxItems: schema.maxItems } : {}),
      uniqueItems: schema.uniqueItems ?? false,
    };
  }

  const configuredOptions = Array.isArray(override?.options)
    ? override.options as readonly FormOption[]
    : undefined;
  const hasDynamicOptions = typeof override?.options === "function";
  let options = configuredOptions ?? unionOptions ?? optionsFromSchema(schema);
  const isFile = isFileSchema(schema) || acceptedMediaTypes !== undefined;
  if (isFile && config.multiple) {
    return unsupported(
      input,
      schema,
      "Multiple file selection requires an array-of-files schema",
    );
  }
  const dataType: FieldDataType = isFile
    ? "file"
    : type === "string" || type === "number" || type === "integer" || type === "boolean"
      ? type
      : "unknown";
  if (nullable && options && !options.some((option) => option.value === null)) {
    options = [...options, { label: "None", value: null }];
  }
  if (nullable && dataType === "boolean" && !options) {
    options = [
      { label: "Yes", value: true },
      { label: "No", value: false },
      { label: "None", value: null },
    ];
  }
  if (dataType === "unknown" && !options) {
    return unsupported(input, schema, `Unsupported JSON Schema type “${type ?? "unknown"}”`);
  }
  const control =
    config.control ??
    (hasDynamicOptions
      ? "select"
      : nullable && dataType === "boolean"
      ? "select"
      : inferControl(dataType, schema, options));
  const nativeType = inputType(control);
  return {
    kind: "scalar",
    ...common,
    dataType,
    control,
    ...(nativeType ? { inputType: nativeType } : {}),
    constraints: constraints(
      schema,
      config as ResolvedFieldConfig<string, unknown>,
      acceptedMediaTypes,
    ),
    ...(options ? { options } : {}),
  };
}

function collectFields<Control extends string, Input>(
  node: FormNode<Control, Input>,
  target: Record<string, FormNode<Control, Input>>,
): void {
  if (node.path) defineOwn(target, node.path, node);
  if (node.kind === "object") {
    for (const child of node.children) collectFields(child, target);
  } else if (node.kind === "array") {
    collectFields(node.item, target);
  }
}

function arkTypeLibraryOptions(
  schema: FormSchema,
  config: FormConfig<unknown, string>,
): Readonly<Record<string, unknown>> | undefined {
  const configured = config.jsonSchema?.libraryOptions;
  if (schema["~standard"].vendor !== "arktype" || config.jsonSchema?.opaqueRefinements === "error") {
    return configured;
  }
  const existingFallback = isRecord(configured?.fallback) ? configured.fallback : {};
  return {
    ...configured,
    fallback: {
      ...existingFallback,
      predicate: (context: { readonly base: Record<string, unknown> }) => context.base,
    },
  };
}

export function toInputJsonSchema<Schema extends FormSchema>(
  schema: Schema,
  config: FormConfig<InferInput<Schema>, string> = {},
): JsonSchemaObject {
  try {
    const jsonSchema = schema["~standard"].jsonSchema.input({
      target: "draft-2020-12",
      ...(arkTypeLibraryOptions(
        schema,
        config as FormConfig<unknown, string>,
      )
        ? { libraryOptions: arkTypeLibraryOptions(schema, config as FormConfig<unknown, string>) }
        : {}),
    });
    return jsonSchema as JsonSchemaObject;
  } catch (error) {
    throw new SchemaConversionError(
      `Unable to convert the ${schema["~standard"].vendor} schema to JSON Schema for form inference.`,
      { cause: error },
    );
  }
}

export function compileForm<
  Schema extends FormSchema,
  Control extends string = never,
>(
  schema: Schema,
  config: FormConfig<InferInput<Schema>, Control> = {},
): FormModel<InferInput<Schema>, Control> {
  const rootSchema = toInputJsonSchema(
    schema,
    config as FormConfig<InferInput<Schema>, string>,
  );
  const context: CompileContext<InferInput<Schema>, Control> = {
    config,
    rootSchema,
    resolvingRefs: new Set(),
  };
  const root = compileNode({
    context,
    key: "root",
    labelFallback: rootSchema.title ?? "Form",
    path: "",
    required: true,
    schema: rootSchema,
  });
  const fieldMap = createNullRecord<FormNode<Control, InferInput<Schema>>>();
  collectFields(root, fieldMap);
  return {
    root,
    fields: root.kind === "object" ? root.children : [root],
    fieldMap,
  };
}
