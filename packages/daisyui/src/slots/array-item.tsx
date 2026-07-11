import { useId, type ReactNode } from "react";

import type { ArrayItemSlotProps } from "@formadapter/react";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";

export function ArrayItem({
  actions,
  children,
  className,
  field,
  index,
  label,
  style,
  ...props
}: ArrayItemSlotProps): ReactNode {
  const labelId = useId();
  const cardClassName = useDaisyUIClassNames("card card-border");
  const cardBodyClassName = useDaisyUIClassNames("card-body");
  const cardTitleClassName = useDaisyUIClassNames("card-title");
  const joinClassName = useDaisyUIClassNames("join");
  const surfaceClassName = useDaisyUIClassNames("border-base-300 bg-base-100");
  return (
    <div
      {...props}
      aria-labelledby={props["aria-labelledby"] ?? labelId}
      className={classNames(
        cardClassName,
        surfaceClassName,
        className,
      )}
      data-array-path={field.path}
      data-item-index={index}
      role={props.role ?? "group"}
      style={style}
    >
      <div className={cardBodyClassName} style={{ gap: "0.75rem", padding: "1rem" }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: "0.5rem",
            justifyContent: "space-between",
          }}
        >
          <span
            className={cardTitleClassName}
            id={labelId}
            style={{ fontSize: "0.875rem" }}
          >
            {label}
          </span>
          <div className={joinClassName}>{actions}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
