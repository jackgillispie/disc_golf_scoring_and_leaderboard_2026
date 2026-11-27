// Unit tests for the TD Tools menu (apps_script/sheet_menu), the script bound
// to each event sheet that forwards to the backend library.
const fs = require("fs");
const path = require("path");
const { loadAppsScript } = require("../helpers/loadAppsScript");
const { manifestForEnvironment } = require("../../scripts/deploy-apps-script");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const environments = JSON.parse(read("apps_script/environments.json"));

// Load menu.js with a fake SpreadsheetApp UI and a recording Backend library.
function loadMenu() {
  const calls = [];
  const menuLog = [];
  const menu = {
    addItem: (label, fn) => { menuLog.push([label, fn]); return menu; },
    addSeparator: () => { menuLog.push(null); return menu; },
    addToUi: () => menuLog.push("added"),
  };
  const backendFns = {};
  const Backend = new Proxy(backendFns, {
    get: (_, name) => () => calls.push(name),
  });
  const fakes = {
    SpreadsheetApp: { getUi: () => ({ createMenu: (title) => { menuLog.push(`menu:${title}`); return menu; } }) },
    Backend,
  };
  const names = ["onOpen", "TD_MENU_ITEMS", "initializeSheets", "populateGroupTokens",
    "createQRCodes", "recalculateLeaderboard", "correctScore"];
  const env = loadAppsScript(["apps_script/sheet_menu/menu.js"], names, fakes);
  return { ...env, calls, menuLog };
}

// Top-level function names declared in the backend project.
function backendFunctions() {
  const dir = path.join(ROOT, "apps_script", "backend");
  const names = new Set();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)) {
      names.add(m[1]);
    }
  }
  return names;
}

describe("TD Tools menu", () => {
  test("onOpen builds the TD Tools menu from TD_MENU_ITEMS", () => {
    const { onOpen, TD_MENU_ITEMS, menuLog } = loadMenu();
    onOpen();
    expect(menuLog[0]).toBe("menu:TD Tools");
    expect(menuLog.slice(1, -1)).toEqual(TD_MENU_ITEMS);
    expect(menuLog[menuLog.length - 1]).toBe("added");
  });

  test("every menu item is a function in menu.js that forwards to the backend function of the same name", () => {
    const env = loadMenu();
    const backend = backendFunctions();
    for (const item of env.TD_MENU_ITEMS.filter(Boolean)) {
      const fn = item[1];
      expect(typeof env[fn]).toBe("function");
      expect(backend.has(fn)).toBe(true);
      env.calls.length = 0;
      env[fn]();
      expect(env.calls).toEqual([fn]);
    }
  });

  test("the backend no longer defines onOpen (a standalone project's onOpen never runs)", () => {
    expect(backendFunctions().has("onOpen")).toBe(false);
  });
});

describe("Backend library in the sheet_menu manifest", () => {
  const manifest = read("apps_script/sheet_menu/appsscript.json");

  test("committed manifest points at the STAGING backend (safe plain clasp push)", () => {
    const lib = JSON.parse(manifest).dependencies.libraries.find((l) => l.userSymbol === "Backend");
    expect(lib.libraryId).toBe(environments.staging.projects.backend.scriptId);
    expect(lib.developmentMode).toBe(true);
  });

  test.each(Object.keys(environments))("deploy points it at the %s backend", (env) => {
    const out = JSON.parse(manifestForEnvironment(manifest, environments[env]));
    const lib = out.dependencies.libraries.find((l) => l.userSymbol === "Backend");
    expect(lib.libraryId).toBe(environments[env].projects.backend.scriptId);
  });

  test("manifests without a Backend library are left untouched", () => {
    const backendManifest = read("apps_script/backend/appsscript.json");
    expect(manifestForEnvironment(backendManifest, environments.production)).toBe(backendManifest);
  });

  test("sheet_menu is listed after backend, so the library is pushed first", () => {
    for (const env of Object.values(environments)) {
      const order = Object.keys(env.projects);
      expect(order.indexOf("backend")).toBeLessThan(order.indexOf("sheet_menu"));
    }
  });
});
