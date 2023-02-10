const withTM = require('next-transpile-modules')(['@cloudscape-design/components']);

const STAGE = process.env.STAGE ?? 'chewbacca';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  basePath: `/${STAGE}/ui`,
};

module.exports = withTM(nextConfig);
