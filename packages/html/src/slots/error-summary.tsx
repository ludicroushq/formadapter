import type { ReactNode } from "react";

import type { ErrorSummarySlotProps } from "@formadapter/react";

export function ErrorSummary({
  errors,
  items,
  onSelect,
  title,
}: ErrorSummarySlotProps): ReactNode {
  const resolvedItems: NonNullable<ErrorSummarySlotProps["items"]> =
    items ?? errors.map((message) => ({ message }));

  if (resolvedItems.length === 0) return null;

  return (
    <div role="alert">
      <strong>{title}</strong>
      <ul>
        {resolvedItems.map((item, index) => {
          const focusPath = item.focusPath;
          return (
            <li key={`${item.path ?? "form"}-${item.message}-${index}`}>
              {focusPath && onSelect ? (
                <button onClick={() => onSelect(focusPath)} type="button">
                  {item.message}
                </button>
              ) : item.message}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
