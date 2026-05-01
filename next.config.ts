import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    // yahoo-finance2 ESM build ships Deno test files that import @std/testing
    // (Deno standard library) — alias them to false so webpack skips them
    config.resolve.alias = {
      ...config.resolve.alias,
      '@std/testing/mock': false,
      '@std/testing/bdd': false,
    };
    return config;
  },
};

export default nextConfig;
