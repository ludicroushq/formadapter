import type { ReactNode } from "react";

import type { UnsupportedSlotProps } from "@formadapter/react";

export function Unsupported({
  field,
  reason,
}: UnsupportedSlotProps): ReactNode {
  return (
    <div role="alert">
      <strong>{field.label}</strong>
      <p>{reason}</p>
    </div>
  );
}
