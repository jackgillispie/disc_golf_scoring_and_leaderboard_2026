// Loads Apps Script source files into an isolated sandbox so their
// functions can be unit-tested in Node.
//
// Apps Script runs every file of a project in ONE shared global scope
// (classic scripts, not modules). We reproduce that by concatenating the
// files and running them with Node's `vm` module. Top-level `const`/`let`
// bindings are not properties of the global object, so the names you want
// back are returned explicitly from the script's last expression.
//
// Usage:
//   const { isValidToken, VALID_TOKENS } = loadAppsScript(
//     ["apps_script/backend/AppsScript_Code.js"],
//     ["isValidToken", "VALID_TOKENS"],
//   );
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");

// Minimal stand-ins so loading a file never touches real services.
// Tests that need behaviour should pass their own fakes via `globals`.
function defaultGlobals() {
  const unavailable = (name) =>
    new Proxy(
      {},
      {
        get() {
          throw new Error(`${name} is not available in unit tests; pass a fake via globals`);
        },
      },
    );
  return {
    console,
    SpreadsheetApp: unavailable("SpreadsheetApp"),
    HtmlService: unavailable("HtmlService"),
    ContentService: unavailable("ContentService"),
    Sheets: unavailable("Sheets"),
  };
}

function loadAppsScript(files, exportNames, globals = {}) {
  const source = files
    .map((f) => fs.readFileSync(path.join(ROOT, f), "utf8"))
    .join("\n;\n");
  const trailer = `\n;({ ${exportNames.join(", ")} });`;
  const context = vm.createContext({ ...defaultGlobals(), ...globals });
  return vm.runInContext(source + trailer, context, { filename: files.join("+") });
}

module.exports = { loadAppsScript };
