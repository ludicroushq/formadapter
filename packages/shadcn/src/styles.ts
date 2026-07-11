import type { ButtonIntent, FormMessageSlotProps } from "@formadapter/react";

export const INPUT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

export const RANGE_CLASS =
  "h-2 w-full cursor-pointer accent-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

export const TEXTAREA_CLASS =
  "field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

export const SELECT_CLASS =
  "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground disabled:pointer-events-none disabled:cursor-not-allowed dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

export const CHECKBOX_CLASS =
  "peer size-4 shrink-0 appearance-none rounded-[4px] border border-input shadow-xs transition-shadow outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 checked:border-primary checked:bg-primary";

export const RADIO_CLASS =
  "peer aspect-square size-4 shrink-0 appearance-none rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[invalid=true]:border-destructive data-[invalid=true]:ring-destructive/20 dark:data-[invalid=true]:ring-destructive/40 checked:border-primary";

const BUTTON_BASE_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

const BUTTON_INTENT_CLASS: Readonly<Record<ButtonIntent, string>> = {
  add: "h-8 border bg-background px-3 shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
  "move-down": "h-8 px-3 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  "move-up": "h-8 px-3 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  next: "h-9 bg-primary px-4 py-2 text-primary-foreground shadow-xs hover:bg-primary/90",
  previous: "h-9 px-4 py-2 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  remove: "h-8 border border-destructive/50 bg-background px-3 text-destructive shadow-xs hover:bg-destructive/10 dark:bg-input/30",
  submit: "h-9 bg-primary px-4 py-2 text-primary-foreground shadow-xs hover:bg-primary/90",
};

export function buttonClass(intent: ButtonIntent): string {
  return `${BUTTON_BASE_CLASS} ${BUTTON_INTENT_CLASS[intent]}`;
}

export const ALERT_BASE_CLASS =
  "relative grid w-full items-start gap-1 rounded-lg border px-4 py-3 text-sm";

export const MESSAGE_KIND_CLASS: Readonly<
  Record<FormMessageSlotProps["kind"], string>
> = {
  error: "border-destructive/50 bg-card text-destructive",
  info: "border-border bg-card text-card-foreground",
  success: "border-border bg-card text-card-foreground",
};
