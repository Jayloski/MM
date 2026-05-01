import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    // yahoo-finance2 ships Deno test utilities in its ESM dist that import
    // Deno-only packages (@std/testing, @gadicc/*). Ignore these imports
    // so webpack doesn't try to resolve them.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@std\/|^@gadicc\//,
        contextRegExp: /yahoo-finance2/,
      })
    );
    return config;
  },
};

export default nextConfig;
