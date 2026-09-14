import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5175,
    strictPort: false,
    host: "0.0.0.0",
    watch: {
      ignored: ["**/~*.tmp"],
    },
  },
});
