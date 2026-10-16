const databaseUrl = process.env.DATABASE_URL ?? "";

const isLocalHost =
  databaseUrl.includes("127.0.0.1") || databaseUrl.includes("localhost");
const isTestDatabase = databaseUrl.endsWith("_test");

if (!isLocalHost || !isTestDatabase) {
  throw new Error(
    `Refusing to run tests against a non-isolated database. DATABASE_URL must point to a local host (127.0.0.1 or localhost) and end with "_test". Got: ${databaseUrl}`
  );
}
