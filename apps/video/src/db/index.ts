import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

type D1Binding = Parameters<typeof drizzle>[0];
declare global {
  interface CloudflareEnv {
    DB: D1Binding;
  }
  var __D1_TEST_DB__: D1Binding | undefined;
}

const createDb = (binding: D1Binding) => drizzle(binding, { schema });
type Database = ReturnType<typeof createDb>;

const databaseCache = new WeakMap<object, Database>();

export function hasDbBinding(): boolean {
  try {
    return Boolean(getCloudflareContext().env.DB);
  } catch {
    return false;
  }
}

function getDb(): Database {
  let binding =
    process.env.NODE_ENV === "test" ? globalThis.__D1_TEST_DB__ : undefined;
  try {
    binding ??= getCloudflareContext().env.DB;
  } catch {
    binding = undefined;
  }

  if (!binding) {
    throw new Error(
      "Missing Cloudflare D1 binding 'DB'. Configure d1_databases in wrangler.jsonc."
    );
  }

  const key = binding as unknown as object;
  const cached = databaseCache.get(key);
  if (cached) return cached;

  const instance = createDb(binding);
  databaseCache.set(key, instance);
  return instance;
}

// Keep imports stable across the application while resolving the request-local
// D1 binding lazily from OpenNext's Cloudflare context.
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = getDb();
    return Reflect.get(instance, prop, instance);
  },
});

export * from "./schema";
