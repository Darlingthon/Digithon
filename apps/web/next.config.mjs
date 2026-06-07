import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // workspace packages are TS source — let Next transpile them
  transpilePackages: ["@trustline/shared", "@trustline/db"],
  // Cloud Run / Docker: emit a self-contained server bundle.
  output: "standalone",
  // Monorepo gotcha: trace files from the repo root so workspace deps
  // (@trustline/*) are included in the standalone output.
  outputFileTracingRoot: join(__dirname, "../../"),
};

export default nextConfig;
