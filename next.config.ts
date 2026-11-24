import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["ws"],
  outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
