"use client";

import type { ReactNode } from "react";

import { FormAdapterProvider } from "@formadapter/react";

import { htmlAdapter } from "./adapter";

export interface HTMLProviderProps {
  readonly children: ReactNode;
}

/** Client boundary that keeps the function-rich adapter out of server props. */
export function HTMLProvider({ children }: HTMLProviderProps): ReactNode {
  return (
    <FormAdapterProvider adapter={htmlAdapter}>
      {children}
    </FormAdapterProvider>
  );
}
