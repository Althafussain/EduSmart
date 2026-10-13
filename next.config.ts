import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js", "jszip"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
