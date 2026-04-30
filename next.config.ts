import type { NextConfig } from 'next';
import type { Configuration } from 'webpack';

const nextConfig: NextConfig = {
  serverExternalPackages: ['yahoo-finance2'],

  webpack(config: Configuration, { isServer }: { isServer: boolean }) {
    if (isServer) {
      // Force yahoo-finance2 and all its internal paths to be resolved
      // by Node.js at runtime rather than bundled by webpack. This is
      // necessary because the package registers methods via side-effect
      // imports that webpack's tree-shaking drops.
      const existing = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...existing,
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && (request === 'yahoo-finance2' || request.startsWith('yahoo-finance2/'))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
