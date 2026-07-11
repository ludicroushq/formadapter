import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import("next").NextConfig} */
const config = {
  devIndicators: false,
  reactStrictMode: true,
  ...(process.env.FORMADAPTER_E2E === "1"
    ? { distDir: ".next-e2e" }
    : {}),
};

export default withMDX(config);
