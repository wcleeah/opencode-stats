import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OpenNext bundles the server for Cloudflare using the `workerd` export condition.
  // Next's file tracing typically only includes the `node` condition variant, which
  // can omit `workerd`-specific entrypoints (e.g. `@libsql/isomorphic-ws`'s `web.mjs`).
  // Marking it as external lets OpenNext copy the full package so the `workerd`
  // condition resolves during bundling.
  serverExternalPackages: ["@libsql/isomorphic-ws"],
};

export default nextConfig;
