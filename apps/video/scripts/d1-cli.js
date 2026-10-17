const { execFileSync } = require("node:child_process");
const path = require("node:path");

const DATABASE_NAME = "dreamutopia-db";
const wrangler = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler"
);

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function executeD1(command) {
  const output = execFileSync(
    wrangler,
    [
      "d1",
      "execute",
      DATABASE_NAME,
      "--remote",
      "--yes",
      "--json",
      "--command",
      command,
    ],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  const payload = JSON.parse(output);
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!first?.success) throw new Error("D1 command failed");
  return first.results ?? [];
}

module.exports = { executeD1, sqlValue };
