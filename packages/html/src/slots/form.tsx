import type { ReactNode } from "react";

import type { FormSlotProps } from "@formadapter/react";

export function Form({ children, ...props }: FormSlotProps): ReactNode {
  return <form {...props}>{children}</form>;
}
