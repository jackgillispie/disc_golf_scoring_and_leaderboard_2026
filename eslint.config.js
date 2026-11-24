// ESLint flat config for the repo root.
// Scope: Apps Script sources, Node scripts/tests, and the inline <script>s
// of the HTML pages (front end + leaderboard). HTML findings are WARNINGS
// for now so CI stays green while they're fixed gradually.
const fs = require("fs");
const path = require("path");
const js = require("@eslint/js");
const globals = require("globals");
const html = require("eslint-plugin-html");

// js.configs.recommended with every rule downgraded to "warn".
const recommendedAsWarnings = Object.fromEntries(
  Object.keys(js.configs.recommended.rules).map((rule) => [rule, "warn"]),
);

// Apps Script runs all files of one project in a single global scope, so a
// function in environment.js is visible in AppsScript_Code.js. ESLint lints
// file by file, so collect each project's top-level declarations and expose
// them as globals to every file in that project folder.
const APPS_SCRIPT_DIR = path.join(__dirname, "apps_script");
function projectGlobals(project) {
  const dir = path.join(APPS_SCRIPT_DIR, project);
  const names = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    for (const m of src.matchAll(/^(?:function\s+|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)/gm)) {
      names[m[1]] = "readonly";
    }
  }
  return names;
}
const appsScriptProjects = fs
  .readdirSync(APPS_SCRIPT_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

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
      "**/node_modules/**",
      "**/.netlify/**",
      "dist/**", // per-environment app builds (scripts/build-app.js)
      "app_files_for_netlify/eslint.config.js",
      "tests/*.py",
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
      // Shared-scope declarations are intentional (see projectGlobals).
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },
  // Per project: make every file see the other files' top-level names.
  ...appsScriptProjects.map((project) => ({
    files: [`apps_script/${project}/**/*.js`],
    languageOptions: { globals: projectGlobals(project) },
  })),
  {
    files: ["tests/**/*.js", "scripts/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    // Inline scripts in the HTML pages (classic browser scripts).
    files: ["**/*.html"],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        google: "readonly", // google.script.run on the Apps Script leaderboard page
      },
    },
    rules: recommendedAsWarnings,
  },
];
