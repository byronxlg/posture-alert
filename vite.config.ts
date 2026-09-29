import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Static site on GitHub Pages at https://byronxlg.com/posture-alert/; base must
// match that path or every asset 404s. eval/index.html is served by the dev
// server for the eval harness and is not part of the production build.
export default defineConfig({
  base: "/posture-alert/",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"] },
});
