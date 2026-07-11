import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();

  return [
    {
      changeFrequency: "weekly",
      priority: 1,
      url: new URL("/", base).href,
    },
    ...source.getPages().map((page) => ({
      changeFrequency: "weekly" as const,
      priority: page.url === "/docs" ? 0.9 : 0.7,
      url: new URL(page.url, base).href,
    })),
  ];
}
