/** @type {import('next').NextConfig} */
const nextConfig = {
  // workspace packages are TS source — let Next transpile them
  transpilePackages: ["@trustline/shared", "@trustline/db"],
};

export default nextConfig;
