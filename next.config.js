/** @type {import('next').NextConfig} */
const nextBasePath = process.env.NEXT_BASE_PATH ?? '';

if (nextBasePath && !nextBasePath.startsWith('/')) {
  throw new Error('NEXT_BASE_PATH must start with "/" when provided.');
}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  basePath: nextBasePath,
};

module.exports = nextConfig;
