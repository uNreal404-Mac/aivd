// Builds for Cloudflare with the deployed site's address.
//
// NEXT_PUBLIC_* values are written into the bundle at build time. Built on a
// developer machine, they would otherwise come from .env.local (localhost),
// and the deployed site would point its canonical links, share cards and
// auth calls at localhost. The address is taken from wrangler.jsonc, the same
// place the runtime vars live, unless it is already set in the environment.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// `--config <file>` picks the Wrangler config to build for (default
// wrangler.jsonc, the preview). The same flag goes on to opennextjs-cloudflare.
// Production lives in its own file, wrangler.prod.jsonc: the values below are
// read with regular expressions, so one file must hold one environment only.
const args = process.argv.slice(2);
const configIndex = args.findIndex((arg) => arg === "--config" || arg.startsWith("--config="));
const configArg =
  configIndex === -1
    ? undefined
    : args[configIndex].includes("=")
      ? args[configIndex].split("=")[1]
      : args[configIndex + 1];
const configPath = resolve(process.cwd(), configArg ?? "wrangler.jsonc");
const wrangler = readFileSync(configPath, "utf8");
console.log(`cf-build: using ${configPath}`);

if (/"REPLACE_[^"]*"/.test(wrangler)) {
  console.error(`cf-build: ${configPath} still has REPLACE_ placeholders; fill in the real resources first.`);
  process.exit(1);
}
const fromWrangler = (key) => wrangler.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))?.[1];

const appUrl = process.env.DEPLOY_APP_URL || fromWrangler("NEXT_PUBLIC_APP_URL");
if (!appUrl || /localhost|127\.0\.0\.1/.test(appUrl)) {
  console.error(`cf-build: refusing to build with app URL "${appUrl ?? ""}". Set NEXT_PUBLIC_APP_URL in wrangler.jsonc or DEPLOY_APP_URL.`);
  process.exit(1);
}
console.log(`cf-build: building for ${appUrl}`);

// Every NEXT_PUBLIC_* var the deployed site runs with must also be in the
// browser bundle; a value that differs (say NEXT_PUBLIC_IS_PREVIEW) makes the
// server and browser render different HTML.
const publicVars = Object.fromEntries(
  [...wrangler.matchAll(/"(NEXT_PUBLIC_[A-Z0-9_]+)"\s*:\s*"([^"]*)"/g)].map(([, key, value]) => [key, value]),
);

const env = {
  ...process.env,
  ...publicVars,
  NEXT_PUBLIC_APP_URL: appUrl,
  APP_URL: fromWrangler("APP_URL") ?? appUrl,
  BETTER_AUTH_URL: fromWrangler("BETTER_AUTH_URL") ?? appUrl,
};
console.log(`cf-build: public vars ${Object.keys(publicVars).join(", ") || "(none)"}`);
const result = spawnSync("npx", ["opennextjs-cloudflare", "build", ...args], { stdio: "inherit", env });
process.exit(result.status ?? 1);
