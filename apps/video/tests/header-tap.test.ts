import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const source = fs.readFileSync(
  path.join(root, "src/components/hf/top-nav.tsx"),
  "utf8"
);

const mobileClassStrings = (source.match(/mobile \? "([^"]*)"/g) ?? []).map(
  (match) => match.replace(/^mobile \? "/, "").replace(/"$/, "")
);

// Collect opening tags, ignoring arrow-function `=>` tokens.
const tags: string[] = [];
const tagStart = /<(Link|button)\b/g;
for (const match of source.matchAll(tagStart)) {
  let index = match.index + match[0].length;
  while (index < source.length) {
    if (source[index] === ">" && source[index - 1] !== "=") {
      index += 1;
      break;
    }
    index += 1;
  }
  tags.push(source.slice(match.index, index));
}

function classNameOf(tag: string) {
  return tag.match(/className="([^"]*)"/)?.[1] ?? "";
}

const interactiveTags = tags.filter((tag) => {
  const className = classNameOf(tag);
  if (className === "") {
    return false;
  }
  return !(className.includes("hidden") && className.includes("lg:flex"));
});

describe("mobile nav tap targets", () => {
  it("gives every renderItem mobile class string a 44px minimum height", () => {
    expect(mobileClassStrings.length).toBeGreaterThan(0);
    for (const className of mobileClassStrings) {
      expect(className).toContain("min-h-11");
    }
  });

  it("gives every non-desktop interactive element a 44px minimum height", () => {
    expect(interactiveTags.length).toBeGreaterThan(0);
    for (const tag of interactiveTags) {
      expect(classNameOf(tag)).toContain("h-11");
    }
  });

  it("gives the menu toggle a 44px square target", () => {
    const toggle = tags.find((tag) => tag.includes("aria-label={menuOpen"));
    expect(toggle).toBeDefined();
    expect(classNameOf(toggle ?? "")).toContain("h-11 w-11");
  });

  it("restores desktop height for always-visible elements", () => {
    expect(source).toContain("lg:min-h-0 lg:min-w-0");
    expect(source).toContain("px-1 lg:h-9 lg:min-w-0");
  });

  it("removes the dead landing header", () => {
    expect(
      fs.existsSync(path.join(root, "src/components/landing/header.tsx"))
    ).toBe(false);
  });
});
