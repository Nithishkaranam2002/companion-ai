import path from "node:path";

import type { NextConfig } from "next";

// On Vercel, a missing API URL would silently point the chat at localhost. Fail the build instead.
if (process.env.VERCEL === "1" && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL must be set for Vercel builds (the Render API URL).");
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
