/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The PWA service worker is served from /public/sw.js. These headers make sure
  // the browser always revalidates it so app updates roll out promptly.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
