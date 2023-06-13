const withTM = require('next-transpile-modules')(['@cloudscape-design/components']);

const STAGE = process.env.NEXT_PUBLIC_STAGE ?? 'chewbacca';
const USING_CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_IS_USING_CUSTOM_DOMAIN ?? false;

const basePath = USING_CUSTOM_DOMAIN ? `/ui` : `/${STAGE}/ui`;
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  basePath,
};

module.exports = withTM(nextConfig);
