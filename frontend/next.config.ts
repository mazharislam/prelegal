import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* FastAPI serves the build as plain files, so there is no Next.js server at
   * runtime. `next dev` is unaffected. */
  output: "export",
};

export default nextConfig;
