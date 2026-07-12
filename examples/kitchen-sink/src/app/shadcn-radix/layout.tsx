"use client";

import { ShadcnRadixProvider } from "@/lib/shadcn-radix";

export default function ShadcnRadixLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <ShadcnRadixProvider>{children}</ShadcnRadixProvider>;
}
