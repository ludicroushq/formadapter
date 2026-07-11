import type { ReactNode } from "react";

import type { UnsupportedSlotProps } from "@formadapter/react";

import { useDaisyUIClassNames } from "../prefix";

export function Unsupported({
  field,
  reason,
}: UnsupportedSlotProps): ReactNode {
  const alertClassName = useDaisyUIClassNames("alert alert-warning");

  return (
    <div className={alertClassName} role="alert">
      <div>
        <strong>{field.label}</strong>
        <p>{reason}</p>
      </div>
    </div>
  );
}
