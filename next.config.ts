import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.112", "192.168.1.112:3000", "localhost:3000"],
  devIndicators: false,
};

export default nextConfig;
