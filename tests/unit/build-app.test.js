// Unit tests for scripts/build-app.js (per-environment backend URL in the scoring app).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PLACEHOLDER, webAppUrl, injectBackendUrl, backendUrlFor, buildApp } = require("../../scripts/build-app");

const ROOT = path.join(__dirname, "..", "..");
const INDEX = path.join(ROOT, "app_files_for_netlify", "app", "index.html");
const ID = "AKfycbTEST_id-123";

test("index.html holds the placeholder exactly once and no hard-coded backend URL", () => {
  const html = fs.readFileSync(INDEX, "utf8");
  expect(html.split(PLACEHOLDER).length - 1).toBe(1);
  expect(html).not.toMatch(/script\.google\.com\/macros\/s\/AKfy/);
});

describe("webAppUrl", () => {
  test("builds the /exec URL from a deployment ID", () => {
    expect(webAppUrl(ID)).toBe(`https://script.google.com/macros/s/${ID}/exec`);
  });

  test.each([null, "", "1MMbaYT2-scriptId", "AKfy/../x"])("rejects %p", (bad) => {
    expect(() => webAppUrl(bad)).toThrow(/deployment ID/);
  });
});

describe("injectBackendUrl", () => {
  test("replaces the placeholder", () => {
    expect(injectBackendUrl(`const U = "${PLACEHOLDER}";`, "https://x/exec")).toBe('const U = "https://x/exec";');
  });

  test("refuses zero or several placeholders", () => {
    expect(() => injectBackendUrl("no placeholder", "u")).toThrow(/found 0/);
    expect(() => injectBackendUrl(PLACEHOLDER + PLACEHOLDER, "u")).toThrow(/found 2/);
  });
});

describe("backendUrlFor", () => {
  const config = {
    staging: { projects: { backend: { deploymentId: ID } } },
    production: { projects: { backend: { deploymentId: null } } },
  };

  test("uses the environment's backend deploymentId", () => {
    expect(backendUrlFor("staging", config)).toBe(webAppUrl(ID));
  });

  test("returns null when the environment has no deployment yet", () => {
    expect(backendUrlFor("production", config)).toBeNull();
  });

  test("throws for an unknown environment", () => {
    expect(() => backendUrlFor("prod", config)).toThrow(/unknown environment/);
  });
});

test("environments.json: each environment has a Netlify site and any deploymentIds are valid", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "apps_script", "environments.json"), "utf8"));
  for (const env of Object.values(config)) {
    expect(env.netlify.siteId).toMatch(/^[0-9a-f-]{36}$/);
    for (const p of Object.values(env.projects)) {
      if (p.deploymentId) expect(() => webAppUrl(p.deploymentId)).not.toThrow();
    }
  }
});

test("buildApp writes the staging site with the staging backend URL", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "build-app-test-"));
  try {
    const { url } = buildApp("staging", out);
    const html = fs.readFileSync(path.join(out, "app", "index.html"), "utf8");
    expect(html).toContain(`const APPS_SCRIPT_URL = "${url}";`);
    expect(html).not.toContain(PLACEHOLDER);
    expect(fs.existsSync(path.join(out, "netlify.toml"))).toBe(true);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
