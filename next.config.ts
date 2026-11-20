import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.18.245", "10.165.222.132"],
  // Keep these packages in node_modules at runtime. @distube/ytdl-core spawns a
  // worker for PO tokens, and ytmusic-api ships its own ESM build.
  serverExternalPackages: ["ytmusic-api", "@distube/ytdl-core"],
  outputFileTracingIncludes: {
    "/api/stream/*": ["./node_modules/@distube/ytdl-core/**/*"],
  },
  // Tailwind runs through PostCSS (postcss.config.mjs) so `next dev`, the
  // production build, and Vercel all compile the same CSS. The Turbopack-only
  // loader rule that used to live here produced no utilities in `next build`.
};

export default nextConfig;
