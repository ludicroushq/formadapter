import type { ReactNode } from "react";

import type { UnsupportedSlotProps } from "@formadapter/react";

import { cn } from "../cn";
import { ALERT_BASE_CLASS } from "../styles";

export function Unsupported({
  field,
  reason,
}: UnsupportedSlotProps): ReactNode {
  return (
    <div
      className={cn(
        ALERT_BASE_CLASS,
        "border-border bg-muted/50 text-foreground",
      )}
      data-slot="alert"
      role="alert"
    >
      <strong className="font-medium tracking-tight">{field.label}</strong>
      <p className="text-muted-foreground">{reason}</p>
    </div>
  );
}
