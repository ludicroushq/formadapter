"use client";

import type { ReactNode } from "react";

import { FormAdapterProvider } from "@formadapter/react";

import { daisyUIAdapter } from "./adapter";
import { DaisyUIClassPrefixProvider } from "./prefix";

export interface DaisyUIProviderProps {
  readonly children: ReactNode;
  /** Must match DaisyUI's `prefix` plugin option, including separators. */
  readonly prefix?: string;
}

/** Client boundary that keeps the function-rich adapter out of Server Component props. */
export function DaisyUIProvider({
  children,
  prefix = "",
}: DaisyUIProviderProps): ReactNode {
  return (
    <DaisyUIClassPrefixProvider prefix={prefix}>
      <FormAdapterProvider adapter={daisyUIAdapter}>
        {children}
      </FormAdapterProvider>
    </DaisyUIClassPrefixProvider>
  );
}
