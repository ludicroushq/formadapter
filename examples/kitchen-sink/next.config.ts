import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.FORMADAPTER_E2E === "1"
    ? { distDir: ".next-e2e" }
    : {}),
  transpilePackages: [
    "@formadapter/core",
    "@formadapter/react",
    "@formadapter/html",
    "@formadapter/daisyui",
    "@formadapter/shadcn"
  ]
};

export default nextConfig;
