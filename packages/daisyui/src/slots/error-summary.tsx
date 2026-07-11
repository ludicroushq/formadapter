import type { ReactNode } from "react";

import type { ErrorSummarySlotProps } from "@formadapter/react";

import { useDaisyUIClassNames } from "../prefix";

export function ErrorSummary({
  errors,
  items,
  onSelect,
  title,
}: ErrorSummarySlotProps): ReactNode {
  const alertClassName = useDaisyUIClassNames("alert alert-error");
  const linkClassName = useDaisyUIClassNames("link link-error");
  const resolvedItems: NonNullable<ErrorSummarySlotProps["items"]> =
    items ?? errors.map((message) => ({ message }));

  if (resolvedItems.length === 0) return null;

  return (
    <div className={alertClassName} role="alert">
      <div>
        <strong>{title}</strong>
        <ul style={{ listStyle: "disc", margin: "0.5rem 0 0 1.25rem" }}>
          {resolvedItems.map((item, index) => {
            const focusPath = item.focusPath;
            return (
              <li key={`${item.path ?? "form"}-${item.message}-${index}`}>
                {focusPath && onSelect ? (
                  <button
                    className={linkClassName}
                    onClick={() => onSelect(focusPath)}
                    type="button"
                  >
                    {item.message}
                  </button>
                ) : item.message}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
