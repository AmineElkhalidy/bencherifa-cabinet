import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the multi-stage Dockerfile: emits a self-contained
  // `.next/standalone/` directory that is copied into the runtime image.
  // See node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
  output: "standalone",

  // Prisma's query engine ships as a native binary that Next.js'
  // bundler should not try to inline.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/engines",
    "archiver",
    "bcryptjs",
  ],

  experimental: {
    // Cap server-action payload to a sane default for medical-doc uploads.
    // Real upload size is enforced at the route handler too (MAX_UPLOAD_MB).
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
