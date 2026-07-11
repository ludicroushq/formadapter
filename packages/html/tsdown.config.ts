import { defineConfig } from "tsdown";

import { createLibraryConfig } from "../../tooling/tsdown.ts";

export default defineConfig([
  createLibraryConfig({ client: true, entry: "src/index.ts" }),
  {
    ...createLibraryConfig({ entry: "src/native.ts" }),
    attw: false,
    clean: false,
    publint: false,
  },
]);
