import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MAGIC_LINK_OPTIONS } from "../src/lib/auth/magic-link-options";

describe("magic-link options", () => {
  it("stores magic-link tokens hashed and keeps the 5 minute expiry", () => {
    expect(MAGIC_LINK_OPTIONS.storeToken).toBe("hashed");
    expect(MAGIC_LINK_OPTIONS.expiresIn).toBe(300);
  });

  it("is spread into the magicLink plugin in auth.ts", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/lib/auth/auth.ts"),
      "utf8",
    );
    const start = source.indexOf("magicLink({");
    const end = source.indexOf("}));", start);
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, end)).toContain("...MAGIC_LINK_OPTIONS");
    expect(source.slice(start, end)).not.toMatch(/storeToken:\s*"plain"/);
  });
});
