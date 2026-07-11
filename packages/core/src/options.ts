import type { FormOption, JsonPrimitive } from "./types";

/** Stable DOM serialization for non-string option values. */
export function serializeOptionValue(value: JsonPrimitive): string {
  if (value === null) return "null:";
  return `${typeof value}:${String(value)}`;
}

export function optionForSerializedValue(
  options: readonly FormOption[],
  serialized: string,
): FormOption | undefined {
  return options.find(
    (option) => serializeOptionValue(option.value) === serialized,
  );
}
