import { defineConfig } from "eslint/config";

import html from "eslint-plugin-html";

export default defineConfig([
  // lint html files
  {
    files: ["**/*.html"],
    plugins: {
      html,
    },
  },
]);
