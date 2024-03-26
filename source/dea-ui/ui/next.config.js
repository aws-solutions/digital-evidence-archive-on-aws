const STAGE = process.env.NEXT_PUBLIC_STAGE ?? 'devsample';
const USING_CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_IS_USING_CUSTOM_DOMAIN?.trim().toLowerCase() === 'true';

const basePath = USING_CUSTOM_DOMAIN ? `/ui` : `/${STAGE}/ui`;

module.exports = {
  // Transpiling is natively integrated with Next.js since 13.1: https://github.com/martpie/next-transpile-modules/releases/tag/the-end
  transpilePackages: ['@cloudscape-design/components', '@cloudscape-design/component-toolkit'],
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  basePath,
};
