import type { ReactNode } from "react";

import type { FormMessageSlotProps } from "@formadapter/react";

import { useDaisyUIClassNames } from "../prefix";

const KIND_CLASS: Readonly<Record<FormMessageSlotProps["kind"], string>> = {
  error: "alert-error",
  info: "alert-info",
  success: "alert-success",
};

export function FormMessage({
  kind,
  message,
}: FormMessageSlotProps): ReactNode {
  const alertClassName = useDaisyUIClassNames("alert", KIND_CLASS[kind]);

  return (
    <div
      className={alertClassName}
      role={kind === "error" ? "alert" : "status"}
    >
      <span>{message}</span>
    </div>
  );
}
