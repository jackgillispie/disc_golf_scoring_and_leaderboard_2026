#!/usr/bin/env node
// Build the player scoring app (Netlify site) for one environment.
//
//   node scripts/build-app.js <staging|production> [outDir]
//
// Copies app_files_for_netlify/ (app/ + netlify.toml) to outDir (default
// dist/netlify-<env>) and replaces the "__APPS_SCRIPT_URL__" placeholder in
// index.html with that environment's backend web-app URL, built from
// projects.backend.deploymentId in apps_script/environments.json.
//
// Local testing: build, then serve the output, e.g.
//   node scripts/build-app.js staging
//   cd dist/netlify-staging && netlify dev
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_SRC = path.join(ROOT, "app_files_for_netlify");
const PLACEHOLDER = "__APPS_SCRIPT_URL__";

function loadEnvironments() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "apps_script", "environments.json"), "utf8"));
}

function webAppUrl(deploymentId) {
  if (!/^AKfy[\w-]+$/.test(deploymentId || "")) {
    throw new Error(`not a web-app deployment ID: ${deploymentId}`);
  }
  return `https://script.google.com/macros/s/${deploymentId}/exec`;
}

// The placeholder must occur exactly once, so a refactor can't silently
// ship a page that still says "__APPS_SCRIPT_URL__".
function injectBackendUrl(html, url) {
  const count = html.split(PLACEHOLDER).length - 1;
  if (count !== 1) throw new Error(`expected 1 ${PLACEHOLDER} in index.html, found ${count}`);
  return html.replace(PLACEHOLDER, url);
}

// Returns the backend URL for an environment, or null when the environment
// has no backend web-app deployment yet (nothing to point the app at).
function backendUrlFor(envName, config = loadEnvironments()) {
  const env = config[envName];
  if (!env) throw new Error(`unknown environment: ${envName}`);
  const id = env.projects.backend.deploymentId;
  return id ? webAppUrl(id) : null;
}

function buildApp(envName, outDir = path.join(ROOT, "dist", `netlify-${envName}`)) {
  const url = backendUrlFor(envName);
  if (!url) throw new Error(`${envName} has no backend deploymentId: nothing to point the app at`);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(path.join(APP_SRC, "app"), path.join(outDir, "app"), { recursive: true });
  fs.copyFileSync(path.join(APP_SRC, "netlify.toml"), path.join(outDir, "netlify.toml"));

  const indexPath = path.join(outDir, "app", "index.html");
  fs.writeFileSync(indexPath, injectBackendUrl(fs.readFileSync(indexPath, "utf8"), url));
  return { outDir, url };
}

module.exports = { PLACEHOLDER, webAppUrl, injectBackendUrl, backendUrlFor, buildApp };

if (require.main === module) {
  const [envName, outDir] = process.argv.slice(2);
  try {
    const { outDir: dir, url } = buildApp(envName, outDir && path.resolve(outDir));
    console.log(`Built ${envName} app in ${path.relative(ROOT, dir)} (backend: ${url})`);
  } catch (err) {
    console.error(`build-app: ${err.message}`);
    process.exit(1);
  }
}
