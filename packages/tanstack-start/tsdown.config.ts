import { defineConfig } from "tsdown";

import { createLibraryConfig } from "../../tooling/tsdown.ts";

export default defineConfig({
  ...createLibraryConfig({
    entry: ["src/index.ts", "src/client.ts", "src/server.ts"],
  }),
  deps: {
    neverBundle: ["@formadapter/core", "@tanstack/react-start", "react"],
  },
});
