import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // ponytail: gzip would buffer the event stream from /api/run; local app, nothing to save
  compress: false,
  devIndicators: false,
  // Local proxy names (e.g. https://roaziy.test via nginx). .test never resolves publicly (RFC 6761);
  // without this the dev server blocks its HMR socket for that origin and the page never becomes interactive.
  allowedDevOrigins: ["*.test"],
}

export default nextConfig
