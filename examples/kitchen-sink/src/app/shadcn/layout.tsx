"use client";

import { ShadcnProvider } from "@formadapter/shadcn";

export default function ShadcnLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <ShadcnProvider>{children}</ShadcnProvider>;
}
