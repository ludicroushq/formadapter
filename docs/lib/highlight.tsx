import type { ReactNode } from "react";
import {
  highlight,
  type HighlightOptions,
} from "fumadocs-core/highlight";

const options = {
  components: {
    pre({ className: _className, style: _style, ...props }) {
      return <pre {...props} />;
    },
  },
  lang: "tsx",
  theme: "github-dark",
} satisfies HighlightOptions;

export function highlightHomepageCode(code: string): Promise<ReactNode> {
  return highlight(code, options);
}
