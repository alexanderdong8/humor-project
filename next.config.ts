import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Uploaded photos are served from Supabase Storage.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cfwupbqjswtvvpcpxnzc.supabase.co",
        pathname: "/storage/v1/object/public/caption-photos/**",
      },
      // Openly licensed photos for the daily AI post (found through Openverse).
      { protocol: "https", hostname: "**.staticflickr.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Meme templates for the daily AI meme.
      { protocol: "https", hostname: "i.imgflip.com" },
    ],
  },
  async redirects() {
    // Older URLs: "Battle" became Upload (caption battles) and Vote (upload vs. upload).
    return [
      { source: "/battle", destination: "/vote", permanent: true },
      { source: "/battle/new", destination: "/upload", permanent: true },
      { source: "/battle/vote", destination: "/vote", permanent: true },
      { source: "/battle/:id([0-9a-fA-F-]{36})", destination: "/post/:id", permanent: true },
      { source: "/post/new", destination: "/upload", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
