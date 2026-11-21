// Unit tests for the pure helpers in apps_script/backend/AppsScript_Code.js.
//
// Conventions:
// - `test(...)` pins CURRENT behaviour so refactors can't change it silently.
// - `test.failing(...)` documents a KNOWN BUG: the test states the CORRECT
//   behaviour and is expected to fail today. When phase 2 fixes the bug,
//   Jest will flag it. Then change `test.failing` to `test`.
const fs = require("fs");
const path = require("path");
const { loadAppsScript } = require("../helpers/loadAppsScript");

const {
  VALID_TOKENS,
  COURSE_HOLES,
  isValidToken,
  sanitizeSubmission,
  buildScoreRow,
  formatVsPar,
  aggregateLeaderboard,
  summarizeHoles,
} = loadAppsScript(
  ["apps_script/backend/AppsScript_Code.js"],
  [
    "VALID_TOKENS",
    "COURSE_HOLES",
    "isValidToken",
    "sanitizeSubmission",
    "buildScoreRow",
    "formatVsPar",
    "aggregateLeaderboard",
    "summarizeHoles",
  ],
);

// Token keys of GROUP_TOKENS in the single-file front end.
function frontendTokenKeys() {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "..", "app_files_for_netlify", "app", "index.html"),
    "utf8",
  );
  const block = html.match(/const GROUP_TOKENS = \{([\s\S]*?)\n\s*\};/);
  if (!block) throw new Error("GROUP_TOKENS block not found in index.html");
  return [...block[1].matchAll(/^\s*"([^"]+)":\s*\{/gm)].map((m) => m[1]);
}

const validSubmission = () => ({
  Tournament: "LKNITP Disc Bash 2026",
  Group: "1A",
  Token: "Anhyzer Anvils",
  Players: "Alex & Sam",
  Hole: 1,
  Par: 3,
  Dist: 276,
  Score: 3,
  VsPar: 0,
  Timestamp: "2026-05-14T20:37:52.641Z",
});

// Raw Scores row: [receivedAt, Tournament, Group, Players, Hole, Par, Dist, Score, VsPar, Token]
const rawRow = (group, hole, score, { par = 3, players = "P" } = {}) => [
  "2026-05-14T20:00:00Z", "T", group, players, hole, par, 200, score, score - par, "tok",
];

describe("isValidToken", () => {
  test("accepts a token on the allow-list", () => {
    expect(isValidToken("Anhyzer Anvils")).toBe(true);
  });

  test.each([undefined, null, "", "Not A Team"])("rejects %p", (token) => {
    expect(isValidToken(token)).toBe(false);
  });

  test.failing("KNOWN BUG: accepts the hyphenated tokens the front end actually sends", () => {
    // index.html sends e.g. "Anhyzer-Anvils"; VALID_TOKENS has "Anhyzer Anvils".
    for (const token of frontendTokenKeys()) {
      expect(isValidToken(token)).toBe(true);
    }
  });
});

describe("token lists", () => {
  test.failing("KNOWN BUG: VALID_TOKENS has no duplicates", () => {
    // "Basket Breakers" appears twice.
    expect(new Set(VALID_TOKENS).size).toBe(VALID_TOKENS.length);
  });

  test.failing("KNOWN BUG: front-end GROUP_TOKENS keys are unique (else a group is unreachable)", () => {
    // "Basket-Breakers" maps to 2A and 2B; the later key wins, so 2A can't be used.
    const keys = frontendTokenKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("sanitizeSubmission", () => {
  test("passes a well-formed submission through unchanged", () => {
    expect(sanitizeSubmission(validSubmission())).toEqual(validSubmission());
  });

  test("blocks the XSS / script payloads from the old mockFunction()", () => {
    const clean = sanitizeSubmission({
      ...validSubmission(),
      Tournament: "javascript: alert(1)",
      Players: "<img src=x onerror=alert('Players')>",
    });
    expect(clean.Tournament).toBeNull();
    expect(clean.Players).toBeNull();
  });

  test.each([
    ["Players", "=IMPORTXML(\"http://x\",\"//a\")"],
    ["Players", "+1+1"],
    ["Tournament", "@SUM(A1)"],
  ])("blocks spreadsheet formula injection in %s: %p", (field, value) => {
    expect(sanitizeSubmission({ ...validSubmission(), [field]: value })[field]).toBeNull();
  });

  test.each([
    ["Group", "1a"], ["Group", "A1"], ["Group", "1AB"],
    ["Hole", "1.5"], ["Hole", "-1"], ["Hole", ""],
    ["Par", "three"], ["Dist", "200ft"], ["Score", " 3"],
    ["VsPar", "+1"], ["Timestamp", "not a date"],
  ])("invalid %s %p becomes null", (field, value) => {
    expect(sanitizeSubmission({ ...validSubmission(), [field]: value })[field]).toBeNull();
  });

  test("accepts numeric strings as well as numbers", () => {
    const clean = sanitizeSubmission({ ...validSubmission(), Hole: "18", Score: "4", VsPar: "-1" });
    expect(clean).toMatchObject({ Hole: "18", Score: "4", VsPar: "-1" });
  });

  test("current behaviour: VsPar allows any digit/hyphen mix (e.g. '--', '1-2')", () => {
    // Weak pattern; phase 2 should tighten to /^-?\d+$/.
    expect(sanitizeSubmission({ ...validSubmission(), VsPar: "--" }).VsPar).toBe("--");
    expect(sanitizeSubmission({ ...validSubmission(), VsPar: "1-2" }).VsPar).toBe("1-2");
  });

  test("Token is passed through untouched (it is validated earlier by isValidToken)", () => {
    const evil = "<script>x</script>";
    expect(sanitizeSubmission({ ...validSubmission(), Token: evil }).Token).toBe(evil);
  });
});

describe("buildScoreRow", () => {
  test("orders columns to match the Raw Scores headers", () => {
    const row = buildScoreRow(validSubmission(), "2026-05-14T21:00:00.000Z");
    expect(row).toEqual([
      "2026-05-14T21:00:00.000Z", // Timestamp (server receipt time)
      "LKNITP Disc Bash 2026",   // Tournament
      "1A",                      // Group
      "Alex & Sam",              // Players
      1, 3, 276, 3, 0,           // Hole, Par, Dist, Score, vs Par
      "Anhyzer Anvils",          // Token
    ]);
  });
});

describe("formatVsPar", () => {
  test.each([[0, "E"], [2, "+2"], [-3, "-3"]])("%p -> %p", (diff, expected) => {
    expect(formatVsPar(diff)).toBe(expected);
  });
});

describe("aggregateLeaderboard", () => {
  test("totals strokes and par per group and ranks lowest vs-par first", () => {
    const result = aggregateLeaderboard([
      rawRow("1A", 1, 4), rawRow("1A", 2, 3), // +1
      rawRow("2B", 1, 2), rawRow("2B", 2, 3), // -1
    ]);
    expect(result.map((g) => [g.group, g.totalScore, g.totalPar, g.diff, g.holesPlayed])).toEqual([
      ["2B", 5, 6, -1, 2],
      ["1A", 7, 6, 1, 2],
    ]);
  });

  test("only the FIRST row per group + hole counts (server arrival order)", () => {
    const result = aggregateLeaderboard([
      rawRow("1A", 1, 5),
      rawRow("1A", 1, 2), // resubmission: ignored
    ]);
    expect(result[0]).toMatchObject({ totalScore: 5, holesPlayed: 1 });
  });

  test("players name comes from the last NEW hole submitted, not resubmissions", () => {
    const result = aggregateLeaderboard([
      rawRow("1A", 1, 3, { players: "First" }),
      rawRow("1A", 1, 3, { players: "Ignored" }),
      rawRow("1A", 2, 3, { players: "Second" }),
    ]);
    expect(result[0].players).toBe("Second");
  });

  test("handles an empty sheet", () => {
    expect(aggregateLeaderboard([])).toEqual([]);
  });

  test.failing("KNOWN BUG: rows whose Group failed validation are not merged into one fake team", () => {
    // sanitizeSubmission stores invalid groups as null -> String(null) === "null".
    const result = aggregateLeaderboard([rawRow(null, 1, 3), rawRow(null, 2, 3)]);
    expect(result.map((g) => g.group)).not.toContain("null");
  });
});

describe("summarizeHoles", () => {
  const holes = [{ n: 1, par: 3, dist: 276 }, { n: 2, par: 4, dist: 383 }];

  test("computes submissions, average (1 dp), best and birdie count per hole", () => {
    const rows = summarizeHoles(
      [rawRow("1A", 1, 2), rawRow("2B", 1, 3), rawRow("3C", 1, 4)],
      holes,
    );
    expect(rows[0]).toEqual([1, 3, 276, 3, 3, 2, 1]);
  });

  test("rounds the average to one decimal place", () => {
    const rows = summarizeHoles([rawRow("1A", 1, 2), rawRow("2B", 1, 3), rawRow("3C", 1, 3)], holes);
    expect(rows[0][4]).toBe(2.7);
  });

  test("shows placeholders for a hole with no submissions", () => {
    expect(summarizeHoles([], holes)[1]).toEqual([2, 4, 383, 0, "—", "—", 0]);
  });

  test.failing("KNOWN BUG: resubmissions are not double-counted (should match the leaderboard rule)", () => {
    const rows = summarizeHoles([rawRow("1A", 1, 3), rawRow("1A", 1, 3)], holes);
    expect(rows[0][3]).toBe(1);
  });
});

describe("COURSE_HOLES", () => {
  test("is the 18-hole, par-55 Brackett's Bluff layout", () => {
    expect(COURSE_HOLES.map((h) => h.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(COURSE_HOLES.reduce((sum, h) => sum + h.par, 0)).toBe(55);
  });
});
