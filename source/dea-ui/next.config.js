const withTM = require("next-transpile-modules")(["@awsui/components-react"]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
};

module.exports = withTM(nextConfig);
