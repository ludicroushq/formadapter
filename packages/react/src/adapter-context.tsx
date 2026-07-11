"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { AnyFormAdapter } from "./adapter";

const AdapterContext = createContext<AnyFormAdapter | undefined>(
  undefined,
);

export interface FormAdapterProviderProps {
  /** The complete adapter for this scope. A nested provider replaces it. */
  readonly adapter: AnyFormAdapter;
  readonly children: ReactNode;
}

export function FormAdapterProvider({
  adapter,
  children,
}: FormAdapterProviderProps): ReactNode {
  return (
    <AdapterContext.Provider value={adapter}>
      {children}
    </AdapterContext.Provider>
  );
}

export function useFormAdapter(): AnyFormAdapter | undefined {
  return useContext(AdapterContext);
}
