// Forward browser API requests to the Go server.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    const origin = new URL(process.env.MUSCLE_API_URL ?? "http://127.0.0.1:8080").origin;
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  }
};

export default nextConfig;
