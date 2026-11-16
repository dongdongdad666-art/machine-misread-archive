import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: "auto",
      manifest: false,
      registerType: "autoUpdate",
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{html,js,css,svg,png,webp,json,webmanifest}"],
        globIgnores: ["**/uploads/**", "**/private-source/**"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/private-source(?:\/|$)/],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    exclude: ["tests/e2e/**", "**/node_modules/**", "**/dist/**"],
    setupFiles: ["./tests/setup.ts"],
  },
});
