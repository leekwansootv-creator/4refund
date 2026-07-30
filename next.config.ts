import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.30.1.40"],
  // GitHub Pages project URLs need the repository prefix, while a custom domain returns an empty path.
  basePath: process.env.PAGES_BASE_PATH ?? "",
  images: {
    // A static host has no Next.js image optimization runtime.
    unoptimized: true,
  },
  output: "export",
  typedRoutes: true,
};

export default nextConfig;
