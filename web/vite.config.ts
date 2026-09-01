import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Pacman",
        short_name: "Pacman",
        description: "Live stat tracking, video, and progress reports for volleyball practices and matches",
        theme_color: "#ea580c",
        background_color: "#fff7ed",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Video uploads/API calls should never be served from cache.
        navigateFallbackDenylist: [/^\/uploads\//, /^\/(auth|teams|players|sessions|stats|reports)\//],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
