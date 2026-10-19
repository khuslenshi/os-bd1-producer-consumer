import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // ponytail: gzip would buffer the event stream from /api/run; local app, nothing to save
  compress: false,
}

export default nextConfig
