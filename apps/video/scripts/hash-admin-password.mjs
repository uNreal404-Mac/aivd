import { pbkdf2Sync, randomBytes } from "node:crypto";

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const password = args.at(-1);
if (!password) {
  console.error("Usage: node scripts/hash-admin-password.mjs <password>");
  process.exit(1);
}

const iterations = 310_000;
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const base64url = (value) => Buffer.from(value).toString("base64url");

process.stdout.write(
  `pbkdf2-sha256$${iterations}$${base64url(salt)}$${base64url(digest)}\n`,
);
