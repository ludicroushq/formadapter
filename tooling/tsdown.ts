import type { UserConfig } from "tsdown";

export interface LibraryConfigOptions {
  client?: boolean;
  entry?: UserConfig["entry"];
}

export function createLibraryConfig(
  options: LibraryConfigOptions = {}
): UserConfig {
  return {
    attw: {
      level: "error",
      profile: "esm-only"
    },
    clean: true,
    dts: {
      sourcemap: false
    },
    entry: options.entry ?? "src/index.ts",
    failOnWarn: true,
    format: ["esm"],
    platform: "neutral",
    publint: true,
    sourcemap: true,
    target: "es2022",
    ...(options.client ? { banner: "'use client';" } : {})
  };
}
