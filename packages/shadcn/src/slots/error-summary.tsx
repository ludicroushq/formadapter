import type { ReactNode } from "react";

import type { ErrorSummarySlotProps } from "@formadapter/react";

import { cn } from "../cn";
import { ALERT_BASE_CLASS } from "../styles";

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
    <div
      className={cn(
        ALERT_BASE_CLASS,
        "border-destructive/50 bg-card text-destructive",
      )}
      data-slot="alert"
      role="alert"
    >
      <strong className="font-medium tracking-tight" data-slot="alert-title">
        {title}
      </strong>
      <ul
        className="ml-4 grid list-disc gap-1 text-destructive/90"
        data-slot="alert-description"
      >
        {resolvedItems.map((item, index) => {
          const focusPath = item.focusPath;
          return (
            <li key={`${item.path ?? "form"}-${item.message}-${index}`}>
              {focusPath && onSelect ? (
                <button
                  className="text-left underline underline-offset-4 outline-none hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
  );
}
