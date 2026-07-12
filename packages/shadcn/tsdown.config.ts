import { createLibraryConfig } from "../../tooling/tsdown.ts";

export default createLibraryConfig({
  client: true,
  entry: ["src/index.ts", "src/baseui.ts", "src/radix.ts"],
});
