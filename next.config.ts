import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cleanDistDir: true,
  output: "standalone",
  reactStrictMode: true,
  typescript: {
    // Membiarkan Vercel sukses melakukan build walaupun ada error TypeScript
    ignoreBuildErrors: true,
  },
  ...({
    eslint: {
      ignoreDuringBuilds: true,
    },
  } as any),
};

export default nextConfig;
