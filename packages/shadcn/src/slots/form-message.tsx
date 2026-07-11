import type { ReactNode } from "react";

import type { FormMessageSlotProps } from "@formadapter/react";

import { cn } from "../cn";
import { ALERT_BASE_CLASS, MESSAGE_KIND_CLASS } from "../styles";

export function FormMessage({
  kind,
  message,
}: FormMessageSlotProps): ReactNode {
  return (
    <div
      className={cn(ALERT_BASE_CLASS, MESSAGE_KIND_CLASS[kind])}
      data-kind={kind}
      data-slot="alert"
      role={kind === "error" ? "alert" : "status"}
    >
      <span>{message}</span>
    </div>
  );
}
