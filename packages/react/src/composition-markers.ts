export const FIELD_COMPONENT: symbol = Symbol.for("@formadapter/react/field");
export const FIELDS_COMPONENT: symbol = Symbol.for("@formadapter/react/fields");
export const STEP_COMPONENT: symbol = Symbol.for("@formadapter/react/step");
export const WHEN_COMPONENT: symbol = Symbol.for("@formadapter/react/when");

export function markComponent(
  component: object,
  marker: symbol,
  owner: object,
): void {
  Object.defineProperty(component, marker, {
    configurable: false,
    enumerable: false,
    value: owner,
    writable: false,
  });
}

export function componentOwner(value: unknown, marker: symbol): object | undefined {
  if (
    (typeof value !== "function" && typeof value !== "object") ||
    value === null
  ) return undefined;
  const owner = (value as Readonly<Record<PropertyKey, unknown>>)[marker];
  return typeof owner === "object" && owner !== null ? owner : undefined;
}
