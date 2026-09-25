/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enables instrumentation.ts, which starts the payer-page check schedule.
    instrumentationHook: true,
  },
  // better-sqlite3 is a native module; keep it external to the server bundle.
  webpack: (config) => {
    config.externals = [...(config.externals || []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
