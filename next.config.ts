import type { NextConfig } from "next";

const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.30.1.40"],
  // GitHub Pages project URLs need the repository prefix, while a custom domain returns an empty path.
  basePath,
  env: {
    // next/image does not add basePath to public asset strings, so expose the same build-time prefix.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    // A static host has no Next.js image optimization runtime.
    unoptimized: true,
  },
  output: "export",
  typedRoutes: true,
};

export default nextConfig;
