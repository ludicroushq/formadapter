import type { CSSProperties } from "react";

export function mergeControlStyle(
  configured: CSSProperties | undefined,
): CSSProperties {
  return {
    width: "100%",
    ...configured,
  };
}
