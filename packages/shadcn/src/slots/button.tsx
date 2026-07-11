import type { ReactNode } from "react";

import type { ButtonSlotProps } from "@formadapter/react";

import { cn } from "../cn";
import { SpinnerIcon } from "../icons";
import { buttonClass } from "../styles";

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
      className={cn(buttonClass(intent))}
      data-intent={intent}
      data-slot="button"
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {pending ? <SpinnerIcon /> : null}
      {children}
    </button>
  );
}
