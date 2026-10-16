import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const getDatabaseUrl = () =>
  process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";

const parseSslConfig = (url: string) => {
  const mode = (
    process.env.DATABASE_SSL_MODE ||
    process.env.DATABASE_SSL ||
    ""
  )
    .toLowerCase()
    .trim();

  if (mode === "disable" || mode === "false" || mode === "0" || mode === "off") {
    return undefined;
  }

  if (mode === "require" || mode === "true" || mode === "1" || mode === "on") {
    return "require" as const;
  }

  const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
  return isLocalhost ? undefined : ("require" as const);
};

const isWorkers =
  typeof navigator !== "undefined" &&
  navigator.userAgent === "Cloudflare-Workers";

function createDb() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
    throw new Error(
      "Missing or invalid DATABASE_URL. Set a valid PostgreSQL connection string in your .env file.\n" +
        "Example: DATABASE_URL='postgresql://user:password@host:port/database'"
    );
  }
  const ssl = parseSslConfig(databaseUrl);
  const sql = isWorkers
    ? postgres(databaseUrl, {
        max: 1,
        ssl,
        prepare: false,
        fetch_types: false,
        connect_timeout: 10,
      })
    : postgres(databaseUrl, {
        max: 10,
        ssl,
      });
  return drizzle(sql, { schema });
}

// On Workers, an I/O object (socket) cannot be reused across requests, so we
// keep one drizzle instance per request keyed by the per-request
// ExecutionContext. Off Workers, we keep a single global lazy instance.
const workersDbCache = new WeakMap<object, ReturnType<typeof createDb>>();

let _db: ReturnType<typeof createDb> | undefined;

function getDb(): ReturnType<typeof createDb> {
  if (!isWorkers) {
    if (!_db) {
      _db = createDb();
    }
    return _db;
  }

  let ctx: object | undefined;
  try {
    ctx = getCloudflareContext().ctx;
  } catch {
    ctx = undefined;
  }

  if (!ctx) {
    return createDb();
  }

  const cached = workersDbCache.get(ctx);
  if (cached) {
    return cached;
  }

  const instance = createDb();
  workersDbCache.set(ctx, instance);
  return instance;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export * from "./schema";
