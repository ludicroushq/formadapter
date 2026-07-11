import type { ReactNode } from "react";

import type { ButtonSlotProps } from "@formadapter/react";

export function Button({
  ariaLabel,
  children,
  disabled,
  intent,
  onClick,
  pending,
  type,
}: ButtonSlotProps): ReactNode {
  return (
    <button
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
      data-intent={intent}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}
