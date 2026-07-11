import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";

import { getSiteUrl } from "@/lib/site";
import "./global.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  applicationName: "FormAdapter",
  metadataBase: getSiteUrl(),
  title: {
    default: "FormAdapter — Schema-native React forms",
    template: "%s — FormAdapter",
  },
  description:
    "Turn Zod or ArkType schemas into typed React forms rendered through DaisyUI or your own design system.",
  keywords: [
    "React forms",
    "Zod forms",
    "ArkType forms",
    "Standard Schema",
    "DaisyUI",
    "Next.js Server Actions",
  ],
  openGraph: {
    title: "FormAdapter — Typed forms from your schema",
    description:
      "Schema-native React forms rendered through your design system.",
    siteName: "FormAdapter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FormAdapter — Typed forms from your schema",
    description:
      "Schema-native React forms rendered through your design system.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html
      className={`${sans.variable} ${mono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
