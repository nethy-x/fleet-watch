import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5180,
    // The browser talks to the API through the dev server: no CORS, one origin.
    proxy: { "/api": "http://localhost:3100" },
  },
});
