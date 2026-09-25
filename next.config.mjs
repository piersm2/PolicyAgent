/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; keep it external to the server bundle.
  webpack: (config) => {
    config.externals = [...(config.externals || []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
