import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { generate as DefaultImage } from "fumadocs-ui/og";

import { getPageImage, source } from "@/lib/source";
import { appName } from "@/lib/shared";

export const revalidate = false;

export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/docs/[...slug]">,
): Promise<ImageResponse> {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return new ImageResponse(
    <DefaultImage
      description={page.data.description}
      site={appName}
      title={page.data.title}
    />,
    {
      height: 630,
      width: 1200,
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: getPageImage(page).segments,
  }));
}
