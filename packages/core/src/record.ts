/** Own-property checks that are safe for null-prototype and hostile-key records. */
export function hasOwn(
  value: object,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Creates a dictionary without inherited names such as `constructor` or
 * `toString`. Use this for path-indexed internal/public maps.
 */
export function createNullRecord<Value>(): Record<string, Value> {
  return Object.create(null) as Record<string, Value>;
}

/** Defines a normal enumerable data property without invoking `__proto__`. */
export function defineOwn<Value>(
  target: Record<string, Value>,
  key: string,
  value: Value,
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function ownValue(
  value: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  return hasOwn(value, key) ? value[key] : undefined;
}
