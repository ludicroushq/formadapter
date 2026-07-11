export function classNames(
  ...values: readonly (string | false | null | undefined)[]
): string | undefined {
  const tokens = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    for (const token of value.split(/\s+/u)) {
      if (token) tokens.add(token);
    }
  }

  return tokens.size > 0 ? [...tokens].join(" ") : undefined;
}
