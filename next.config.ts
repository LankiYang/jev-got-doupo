import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The Redis client reaches for `node:net` and `node:tls` and builds its command
   * table at require time, so the server calls it rather than bundling it.
   */
  serverExternalPackages: ["ioredis"],
  /**
   * Without this, the dev server blocks cross-origin requests to HMR from the ngrok
   * tunnel, which throws the client into a reconnect-and-reload loop that never lets
   * the opening scene finish loading.
   */
  allowedDevOrigins: ["negative-cogwheel-debrief.ngrok-free.dev"],
};

export default nextConfig;
