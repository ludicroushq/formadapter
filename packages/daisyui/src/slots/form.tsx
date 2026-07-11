import type { ReactNode } from "react";

import type { FormSlotProps } from "@formadapter/react";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";

export function Form({
  children,
  className,
  style,
  ...props
}: FormSlotProps): ReactNode {
  const fieldsetClassName = useDaisyUIClassNames("fieldset");

  return (
    <form
      {...props}
      className={classNames(fieldsetClassName, className)}
      style={{
        display: "grid",
        gap: "1rem",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </form>
  );
}
