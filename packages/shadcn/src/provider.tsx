"use client";

import type { ReactNode } from "react";

import { FormAdapterProvider } from "@formadapter/react";

import { shadcnAdapter } from "./adapter";

export interface ShadcnProviderProps {
  readonly children: ReactNode;
}

/** Client boundary that keeps the function-rich adapter out of Server Component props. */
export function ShadcnProvider({
  children,
}: ShadcnProviderProps): ReactNode {
  return (
    <FormAdapterProvider adapter={shadcnAdapter}>
      {children}
    </FormAdapterProvider>
  );
}
