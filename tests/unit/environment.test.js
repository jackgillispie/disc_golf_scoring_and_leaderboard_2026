// Unit tests for apps_script/*/environment.js (getEventSpreadsheet, getEnvironmentName, getAppBaseUrl).
const fs = require("fs");
const path = require("path");
const { loadAppsScript } = require("../helpers/loadAppsScript");

const ROOT = path.join(__dirname, "..", "..");

// Fakes for the two services the helper uses.
function load({ props = {}, active = null } = {}) {
  const opened = [];
  const fakes = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }),
    },
    SpreadsheetApp: {
      openById: (id) => { opened.push(id); return { id }; },
      getActiveSpreadsheet: () => active,
    },
  };
  const env = loadAppsScript(
    ["apps_script/backend/environment.js"],
    ["getEventSpreadsheet", "getEnvironmentName", "getAppBaseUrl"],
    fakes,
  );
  return { ...env, opened };
}

describe("getEventSpreadsheet", () => {
  test("opens the spreadsheet named by Script Property SPREADSHEET_ID", () => {
    const { getEventSpreadsheet, opened } = load({ props: { SPREADSHEET_ID: "abc123" } });
    expect(getEventSpreadsheet()).toEqual({ id: "abc123" });
    expect(opened).toEqual(["abc123"]);
  });

  test("falls back to the bound (active) spreadsheet when no property is set", () => {
    const active = { id: "bound" };
    const { getEventSpreadsheet, opened } = load({ active });
    expect(getEventSpreadsheet()).toBe(active);
    expect(opened).toEqual([]);
  });

  test("throws a clear error when neither is available", () => {
    const { getEventSpreadsheet } = load();
    expect(() => getEventSpreadsheet()).toThrow(/SPREADSHEET_ID/);
  });
});

describe("getEnvironmentName", () => {
  test("returns the ENVIRONMENT property", () => {
    expect(load({ props: { ENVIRONMENT: "staging" } }).getEnvironmentName()).toBe("staging");
  });

  test("returns 'unset' when missing (smoke tests then refuse to run)", () => {
    expect(load().getEnvironmentName()).toBe("unset");
  });
});

describe("getAppBaseUrl", () => {
  const url = (APP_BASE_URL) => load({ props: { APP_BASE_URL } }).getAppBaseUrl();

  test("returns the APP_BASE_URL property", () => {
    expect(url("lknitpdiscgolf2026.netlify.app")).toBe("lknitpdiscgolf2026.netlify.app");
  });

  test("strips scheme, whitespace and trailing slashes", () => {
    expect(url("  https://staging--site.netlify.app/ ")).toBe("staging--site.netlify.app");
    expect(url("HTTP://site.netlify.app//")).toBe("site.netlify.app");
  });

  test("throws a clear error when unset or blank (never defaults to production)", () => {
    expect(() => load().getAppBaseUrl()).toThrow(/APP_BASE_URL/);
    expect(() => url("   ")).toThrow(/APP_BASE_URL/);
  });
});

test("backend and leaderboard copies of environment.js are identical", () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, "apps_script", p, "environment.js"), "utf8").replace(/\r\n/g, "\n");
  expect(read("leaderboard")).toBe(read("backend"));
});
