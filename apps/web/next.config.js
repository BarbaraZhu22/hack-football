const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    "/api/models/[...assetPath]": ["./components/three/models/**/*"],
  },
};

module.exports = nextConfig;
