// ESLint flat config for the repo root.
// Scope (phase 1): Apps Script sources + Jest tests.
// The Netlify front end (single-file index.html) is linted separately later.
const js = require("@eslint/js");
const globals = require("globals");

// Apps Script services used as globals. Add new ones here when needed.
const appsScriptGlobals = {
  SpreadsheetApp: "readonly",
  HtmlService: "readonly",
  ContentService: "readonly",
  Sheets: "readonly", // advanced service (backend manifest)
  Logger: "readonly",
  PropertiesService: "readonly",
  LockService: "readonly",
  Session: "readonly",
  Utilities: "readonly",
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "app_files_for_netlify/**",
      "tests/*.py",
      "**/*.html",
    ],
  },
  js.configs.recommended,
  {
    // Apps Script: classic scripts sharing one global scope per project.
    files: ["apps_script/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...appsScriptGlobals, console: "readonly" },
    },
    rules: {
      // Top-level functions are entry points (doGet, doPost, menu items)
      // or called from other files in the project, so only check locals.
      "no-unused-vars": ["warn", { vars: "local", args: "none" }],
    },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.jest },
    },
  },
];
