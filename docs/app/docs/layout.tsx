import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <DocsLayout
      {...baseOptions()}
      sidebar={{ defaultOpenLevel: 1, prefetch: false }}
      tree={source.getPageTree()}
    >
      {children}
    </DocsLayout>
  );
}
