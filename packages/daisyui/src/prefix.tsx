"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { classNames } from "./class-names";

const DaisyUIClassPrefixContext = createContext("");

// DaisyUI prefixes its component classes and their modifiers, but theme-backed
// Tailwind utilities such as `text-error`, `bg-base-200`, and `rounded-box`
// retain their ordinary names. Keep this list at the component-family level so
// new modifiers (for example `btn-*`) inherit the correct behavior.
const DAISY_UI_COMPONENT_CLASS_ROOTS = [
  "alert",
  "btn",
  "card",
  "checkbox",
  "fieldset",
  "file-input",
  "input",
  "join",
  "label",
  "link",
  "loading",
  "progress",
  "radio",
  "range",
  "select",
  "textarea",
] as const;

function isDaisyUIComponentClass(token: string): boolean {
  return DAISY_UI_COMPONENT_CLASS_ROOTS.some((root) =>
    token === root || token.startsWith(`${root}-`)
  );
}

interface DaisyUIClassPrefixProviderProps {
  readonly children: ReactNode;
  readonly prefix: string;
}

export function DaisyUIClassPrefixProvider({
  children,
  prefix,
}: DaisyUIClassPrefixProviderProps): ReactNode {
  return (
    <DaisyUIClassPrefixContext.Provider value={prefix}>
      {children}
    </DaisyUIClassPrefixContext.Provider>
  );
}

/** Prefixes DaisyUI component classes without rewriting Tailwind utilities. */
export function useDaisyUIClassNames(
  ...values: readonly (string | false | null | undefined)[]
): string | undefined {
  const prefix = useContext(DaisyUIClassPrefixContext);

  return classNames(
    ...values.map((value) => {
      if (!value || prefix.length === 0) return value;
      return value
        .split(/\s+/u)
        .filter(Boolean)
        .map((token) =>
          isDaisyUIComponentClass(token) ? `${prefix}${token}` : token
        )
        .join(" ");
    }),
  );
}
