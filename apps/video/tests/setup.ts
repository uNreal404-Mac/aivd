import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll } from "vitest";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Refusing to run tests with NODE_ENV=production. Database tests must use Wrangler's local D1 binding."
  );
}

type D1Binding = Parameters<typeof drizzle>[0];
const platform = await getPlatformProxy<{ DB: D1Binding }>({
  configPath: path.resolve(process.cwd(), "wrangler.jsonc"),
  remoteBindings: false,
  persist: false,
});

const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error(`No migration files found in ${migrationsDir}`);
}

for (const file of migrationFiles) {
  const migration = await readFile(path.join(migrationsDir, file), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) await platform.env.DB.prepare(trimmed).run();
  }
}

globalThis.__D1_TEST_DB__ = platform.env.DB;

afterAll(async () => {
  globalThis.__D1_TEST_DB__ = undefined;
  await platform.dispose();
});

