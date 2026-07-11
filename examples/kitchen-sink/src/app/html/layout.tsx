"use client";

import { HTMLProvider } from "@formadapter/html";

export default function NativeHTMLLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <HTMLProvider>{children}</HTMLProvider>;
}
