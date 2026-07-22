import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` must match the GitHub Pages repo name, e.g. "/career-sim/".
// If deploying to a user/org root page, set this to "/".
export default defineConfig({
  plugins: [react()],
  base: "./",
});
