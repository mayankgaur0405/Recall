import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phone and emulator hosts that may call this Next server during local share testing.
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.2.2", "192.168.29.74"],
};

export default nextConfig;
