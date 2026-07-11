import type { ReactNode } from "react";

import type {
  ButtonIntent,
  ButtonSlotProps,
} from "@formadapter/react";

import { useDaisyUIClassNames } from "../prefix";

const INTENT_CLASS: Readonly<Record<ButtonIntent, string>> = {
  add: "btn-outline btn-sm",
  "move-down": "btn-ghost btn-sm join-item",
  "move-up": "btn-ghost btn-sm join-item",
  next: "btn-primary",
  previous: "btn-ghost",
  remove: "btn-error btn-outline btn-sm join-item",
  submit: "btn-primary",
};

export function Button({
  ariaLabel,
  children,
  disabled,
  intent,
  onClick,
  pending,
  type,
}: ButtonSlotProps): ReactNode {
  const buttonClassName = useDaisyUIClassNames("btn", INTENT_CLASS[intent]);
  const loadingClassName = useDaisyUIClassNames(
    "loading loading-spinner loading-xs",
  );

  return (
    <button
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      className={buttonClassName}
      data-intent={intent}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {pending ? (
        <span aria-hidden="true" className={loadingClassName} />
      ) : null}
      {children}
    </button>
  );
}
