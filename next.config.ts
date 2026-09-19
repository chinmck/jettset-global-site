import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    // The /bio-atelier-wellness -> /aviation-wellness rename: the
    // static page that used to live at that path is gone, and the
    // repo's root _redirects file (even with the `!` force flag)
    // wasn't enough to redirect it — requests were still reaching
    // Next.js's own catch-all and 404ing before Netlify's redirect
    // rules got a chance to apply. A native Next.js redirect is
    // handled by the framework's own router, so it's guaranteed to
    // fire ahead of any 404 regardless of how Netlify's plugin merges
    // or orders redirects at the edge.
    return [
      {
        source: "/bio-atelier-wellness",
        destination: "/aviation-wellness",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
