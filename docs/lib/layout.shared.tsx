import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { Brand } from "@/components/brand";
import { repositoryUrl } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Brand />,
      url: "/",
    },
    links: [
      {
        text: "Docs",
        url: "/docs",
      },
    ],
    githubUrl: repositoryUrl,
  };
}
