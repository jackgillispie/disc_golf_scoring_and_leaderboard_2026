#!/usr/bin/env node
// Build and deploy the player scoring app to one environment's Netlify site.
//
//   node scripts/deploy-netlify.js <staging|production>
//
// The site comes from <env>.netlify.siteId in apps_script/environments.json;
// the backend URL baked into the page comes from build-app.js. Auth: the
// NETLIFY_AUTH_TOKEN environment variable (CI) or `netlify login` (local).
//
// If the environment has no backend web-app deployment yet, the deploy is
// skipped: publishing would replace the live page with one that can't
// submit scores.
const path = require("path");
const { spawnSync } = require("child_process");
const { backendUrlFor, buildApp } = require("./build-app");

const ROOT = path.resolve(__dirname, "..");

function fail(msg) {
  console.error(`deploy-netlify: ${msg}`);
  process.exit(1);
}

function netlify(args, cwd) {
  console.log(`$ netlify ${args.join(" ")}`);
  // Same Windows .cmd shim handling as deploy-apps-script.js.
  const windows = process.platform === "win32";
  const res = windows
    ? spawnSync(["netlify", ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" "), {
        cwd, encoding: "utf8", shell: true,
      })
    : spawnSync("netlify", args, { cwd, encoding: "utf8" });
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) {
    if (res.stdout) process.stdout.write(res.stdout);
    fail(`netlify ${args[0]} failed (exit ${res.status})`);
  }
  return res.stdout || "";
}

function main() {
  const [envName] = process.argv.slice(2);
  const config = require(path.join(ROOT, "apps_script", "environments.json"));
  const env = config[envName];
  if (!env) fail(`usage: deploy-netlify.js <${Object.keys(config).join("|")}>`);
  if (!env.netlify || !env.netlify.siteId) fail(`${envName} has no netlify.siteId`);

  console.log(`\n== ${envName}/netlify -> ${env.netlify.url || env.netlify.siteId}`);
  if (!backendUrlFor(envName, config)) {
    console.log(`::warning::${envName} has no backend deploymentId; Netlify deploy skipped (see docs/deployment.md)`);
    return;
  }

  const { outDir, url } = buildApp(envName);
  console.log(`built ${path.relative(ROOT, outDir)} (backend: ${url})`);

  const sha = (process.env.GITHUB_SHA || "local").slice(0, 7);
  const out = netlify(
    ["deploy", "--prod", "--no-build", "--json", "--dir", "app",
      "--site", env.netlify.siteId, "--message", `${envName} ${sha}`],
    outDir,
  );
  let live = env.netlify.url;
  try {
    const json = JSON.parse(out.slice(out.indexOf("{")));
    live = json.url || live;
    console.log(`deploy ${json.deploy_id}: ${json.deploy_url}`);
  } catch {
    // Older CLIs print text; the exit code already told us it worked.
  }
  console.log(`Done: ${envName} app live at ${live}`);
}

main();
