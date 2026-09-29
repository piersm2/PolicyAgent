/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enables instrumentation.ts, which starts the payer-page check schedule.
    instrumentationHook: true,
    // Loaded from node_modules at run time instead of bundled: unpdf (PDF text) ships an
    // ES module webpack can't bundle cleanly; playwright-core drives a real browser.
    serverComponentsExternalPackages: ["unpdf", "mammoth", "playwright-core"],
  },
  // better-sqlite3 is a native module; keep it external to the server bundle.
  webpack: (config) => {
    config.externals = [...(config.externals || []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
