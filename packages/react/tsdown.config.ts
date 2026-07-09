import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: {
    sourcemap: true
  },
  entry: "src/index.ts",
  format: ["esm"],
  platform: "neutral",
  sourcemap: true
});

