import { useId, type ReactNode } from "react";

import type { ArrayItemSlotProps } from "@formadapter/react";

import { cn } from "../cn";

export function ArrayItem({
  actions,
  children,
  className,
  field,
  index,
  label,
  ...props
}: ArrayItemSlotProps): ReactNode {
  const labelId = useId();

  return (
    <div
      {...props}
      aria-labelledby={props["aria-labelledby"] ?? labelId}
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-background p-4 text-foreground shadow-xs",
        className,
      )}
      data-array-path={field.path}
      data-item-index={index}
      data-slot="card"
      role={props.role ?? "group"}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-sm font-semibold"
          data-slot="card-title"
          id={labelId}
        >
          {label}
        </span>
        <div className="flex items-center gap-1" data-slot="card-action">
          {actions}
        </div>
      </div>
      <div className="grid gap-4" data-slot="card-content">
        {children}
      </div>
    </div>
  );
}
