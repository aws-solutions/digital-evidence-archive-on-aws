const withTM = require('next-transpile-modules')(['@cloudscape-design/components']);

const STAGE = 'test';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  basePath: `/${STAGE}/ui`,
};

module.exports = withTM(nextConfig);
