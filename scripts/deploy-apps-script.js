#!/usr/bin/env node
// Push the Apps Script projects to one environment (staging or production).
//
//   node scripts/deploy-apps-script.js <staging|production> [--project backend|leaderboard|sheet_menu]
//
// IDs come from apps_script/environments.json. Each project folder is copied
// to a temp dir with a generated .clasp.json, so the committed .clasp.json
// files (which point at STAGING) are never modified.
//
// If an environment's project has a "deploymentId", a new version is created
// and that web-app deployment is updated to it (its URL stays the same).
// Requires clasp to be logged in (~/.clasprc.json), locally or in CI.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APPS_SCRIPT_DIR = path.join(ROOT, "apps_script");
const PUSHABLE = /^(appsscript\.json|.*\.(js|gs|html))$/;

function fail(msg) {
  console.error(`deploy-apps-script: ${msg}`);
  process.exit(1);
}

function clasp(args, cwd) {
  console.log(`$ clasp ${args.join(" ")}`);
  // On Windows clasp is a .cmd shim, which needs a shell; quote arguments
  // with spaces ourselves because the shell would otherwise split them.
  const windows = process.platform === "win32";
  const res = windows
    ? spawnSync(["clasp", ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" "), {
        cwd, encoding: "utf8", shell: true,
      })
    : spawnSync("clasp", args, { cwd, encoding: "utf8" });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) fail(`clasp ${args[0]} failed (exit ${res.status})`);
  return res.stdout || "";
}

// The committed manifests point any "Backend" library at the STAGING
// backend (so a plain `clasp push` works for staging). Point it at this
// environment's backend instead. Returns the manifest text unchanged when
// it has no such library.
function manifestForEnvironment(manifestText, envConfig) {
  const manifest = JSON.parse(manifestText);
  const libs = (manifest.dependencies && manifest.dependencies.libraries) || [];
  const backend = libs.find((l) => l.userSymbol === "Backend");
  if (!backend) return manifestText;
  const id = envConfig.projects.backend && envConfig.projects.backend.scriptId;
  if (!id) throw new Error("environment has no backend scriptId for the Backend library");
  backend.libraryId = id;
  return JSON.stringify(manifest, null, 2) + "\n";
}

function deployProject(envName, project, cfg, envConfig) {
  if (!cfg.scriptId) {
    // e.g. production's sheet_menu before the event spreadsheet exists.
    console.log(`\n== ${envName}/${project}: no scriptId configured, skipped`);
    return false;
  }
  const src = path.join(APPS_SCRIPT_DIR, project);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `clasp-${envName}-${project}-`));
  try {
    for (const f of fs.readdirSync(src)) {
      if (PUSHABLE.test(f)) fs.copyFileSync(path.join(src, f), path.join(tmp, f));
    }
    const manifestPath = path.join(tmp, "appsscript.json");
    fs.writeFileSync(manifestPath, manifestForEnvironment(fs.readFileSync(manifestPath, "utf8"), envConfig));
    fs.writeFileSync(
      path.join(tmp, ".clasp.json"),
      JSON.stringify({ scriptId: cfg.scriptId, rootDir: "", skipSubdirectories: true }, null, 2),
    );

    console.log(`\n== ${envName}/${project} -> ${cfg.title || cfg.scriptId}`);
    clasp(["push", "--force"], tmp);

    if (cfg.deploymentId) {
      const sha = (process.env.GITHUB_SHA || "local").slice(0, 7);
      const out = clasp(["version", `${envName} ${sha}`], tmp);
      const m = out.match(/Created version (\d+)/);
      if (!m) fail("could not read the new version number from clasp output");
      clasp(["redeploy", cfg.deploymentId, "-V", m[1], "-d", `${envName} ${sha}`], tmp);
    } else {
      console.log("(no deploymentId configured: code pushed, no web-app deployment updated)");
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return true;
}

function main() {
  const [envName, ...rest] = process.argv.slice(2);
  const config = JSON.parse(fs.readFileSync(path.join(APPS_SCRIPT_DIR, "environments.json"), "utf8"));
  if (!config[envName]) fail(`usage: deploy-apps-script.js <${Object.keys(config).join("|")}> [--project name]`);

  const i = rest.indexOf("--project");
  const only = i >= 0 ? rest[i + 1] : null;
  const projects = Object.entries(config[envName].projects).filter(([name]) => !only || name === only);
  if (projects.length === 0) fail(`no project named ${only}`);

  // Order matters: environments.json lists backend before sheet_menu, so
  // the library code is pushed before the sheet script that uses it.
  const pushed = projects.filter(([name, cfg]) => deployProject(envName, name, cfg, config[envName]));
  console.log(pushed.length
    ? `\nDone: ${pushed.map(([n]) => n).join(", ")} pushed to ${envName}.`
    : `\nDone: nothing pushed to ${envName} (no project has a scriptId).`);
}

module.exports = { manifestForEnvironment };

if (require.main === module) main();
