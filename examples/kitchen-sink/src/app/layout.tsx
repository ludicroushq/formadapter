import type { Metadata } from "next";

import { DaisyUIProvider } from "@formadapter/daisyui";

import "./globals.css";

export const metadata: Metadata = {
  description: "Bare-bones FormAdapter examples.",
  title: "FormAdapter examples",
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html data-theme="light" lang="en">
      <body>
        <DaisyUIProvider>{children}</DaisyUIProvider>
      </body>
    </html>
  );
}
