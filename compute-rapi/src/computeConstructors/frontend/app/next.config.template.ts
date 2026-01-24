import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/@gen{MS_SLUG}',
  reactStrictMode: true,
  transpilePackages: ['@ps/shared-core', '@ps/redux-core', '@ps/entity-core'],
};

export default nextConfig;
