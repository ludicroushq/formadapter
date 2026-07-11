import type { ReactNode } from "react";

import type { FormMessageSlotProps } from "@formadapter/react";

export function FormMessage({
  kind,
  message,
}: FormMessageSlotProps): ReactNode {
  return (
    <div
      data-kind={kind}
      role={kind === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
