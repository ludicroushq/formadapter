import { useId, type ReactNode } from "react";

import type { ArrayItemSlotProps } from "@formadapter/react";

export function ArrayItem({
  actions,
  children,
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
      data-array-path={field.path}
      data-item-index={index}
      role={props.role ?? "group"}
    >
      <div>
        <span id={labelId}>{label}</span>
        {actions}
      </div>
      {children}
    </div>
  );
}
