import type { ReactNode } from "react";

import type { FormSlotProps } from "@formadapter/react";

import { cn } from "../cn";

export function Form({
  children,
  className,
  ...props
}: FormSlotProps): ReactNode {
  return (
    <form
      {...props}
      className={cn("grid w-full gap-6", className)}
      data-slot="form"
    >
      {children}
    </form>
  );
}
