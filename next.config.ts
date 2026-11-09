import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Briefs are read from storage on every request, so the classic dynamic model is enough here.
  cacheComponents: false,
};

export default nextConfig;
