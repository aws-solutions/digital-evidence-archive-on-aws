const withTM = require('next-transpile-modules')(['@cloudscape-design/components']);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  basePath: '/prod'
};

module.exports = withTM(nextConfig);
