const STANDARD_OBJECT_PROTOTYPE_SEGMENTS = [
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "__proto__",
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf",
] as const;

export type ReservedFormPathSegment =
  | (typeof STANDARD_OBJECT_PROTOTYPE_SEGMENTS)[number]
  | "prototype"
  | "root";

/** Names that collide with JavaScript object lookup or form-runtime state. */
export const RESERVED_FORM_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  "prototype",
  "root",
]);

export function formPathSegmentError(segment: string): string | undefined {
  if (segment.length === 0) {
    return "Empty property names cannot be represented in a form path";
  }
  if (RESERVED_FORM_PATH_SEGMENTS.has(segment)) {
    return `Property name “${segment}” is reserved and cannot be represented safely in a form path`;
  }
  if (segment.startsWith("__formadapter_")) {
    return `Property name “${segment}” uses FormAdapter's reserved internal namespace`;
  }
  if (segment.startsWith("$ACTION_")) {
    return `Property name “${segment}” uses a reserved server-action prefix and cannot be represented safely`;
  }
  if (
    segment.includes(".") ||
    segment.includes("[") ||
    segment.includes("]") ||
    segment.includes("'") ||
    segment.includes('"')
  ) {
    return `Property name “${segment}” contains form-path syntax and cannot be represented safely`;
  }
  if (!Number.isNaN(Number(segment))) {
    return `Numeric-like property name “${segment}” cannot be distinguished safely from an array index`;
  }
  return undefined;
}

/** True when a schema property cannot be represented losslessly as one path segment. */
export function isReservedFormPathSegment(segment: string): boolean {
  return formPathSegmentError(segment) !== undefined;
}
