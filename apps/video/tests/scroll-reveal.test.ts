import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { bindScrollReveal, type RevealTarget, type RevealWatcher } from "@/lib/scroll-reveal";

/** A section whose top edge is `top` pixels below the top of the screen; `moveTo` scrolls it. */
function section(top: number, height = 400): RevealTarget & { moveTo(top: number): void } {
  let at = top;
  return {
    dataset: {},
    getBoundingClientRect: () => ({ top: at, bottom: at + height }),
    moveTo: (next) => {
      at = next;
    },
  };
}

/** Stands in for an IntersectionObserver; `enter` reports a section in view. */
function fakeWatcher() {
  const watched = new Set<RevealTarget>();
  let onEnter: (target: RevealTarget) => void = () => undefined;
  let disconnected = false;
  const watch = (callback: (target: RevealTarget) => void): RevealWatcher<RevealTarget> => {
    onEnter = callback;
    return {
      observe: (target) => void watched.add(target),
      disconnect: () => {
        disconnected = true;
        watched.clear();
      },
    };
  };
  return { watch, watched, enter: (target: RevealTarget) => onEnter(target), isDisconnected: () => disconnected };
}

const SCREEN = 900;

describe("scroll reveal", () => {
  it("never hides a section that is on screen or above it", () => {
    const above = section(-400);
    const onScreen = section(300);
    const atTheFoot = section(SCREEN - 1);
    const watcher = fakeWatcher();
    bindScrollReveal([above, onScreen, atTheFoot], SCREEN, watcher.watch);

    expect(above.dataset.reveal).toBeUndefined();
    expect(onScreen.dataset.reveal).toBeUndefined();
    expect(atTheFoot.dataset.reveal).toBeUndefined();
    expect(watcher.watched.size).toBe(0);
  });

  it("makes a section below the screen wait, then rise in once when it arrives", () => {
    const justBelow = section(SCREEN);
    const farBelow = section(4000);
    const watcher = fakeWatcher();
    bindScrollReveal([justBelow, farBelow], SCREEN, watcher.watch);

    expect(justBelow.dataset.reveal).toBe("wait");
    expect(farBelow.dataset.reveal).toBe("wait");
    expect(watcher.watched.has(justBelow)).toBe(true);

    watcher.enter(justBelow);
    expect(justBelow.dataset.reveal).toBe("in");
    expect(farBelow.dataset.reveal).toBe("wait");
  });

  it("shows a section plainly once a jump down the page has passed it", () => {
    const passed = section(1200);
    const landedOn = section(3000);
    const stillBelow = section(5000);
    const watcher = fakeWatcher();
    bindScrollReveal([passed, landedOn, stillBelow], SCREEN, watcher.watch);

    // The page jumps 2800px down: the first section is now above the screen
    // and was never in view, the second is on screen.
    passed.moveTo(1200 - 2800);
    landedOn.moveTo(3000 - 2800);
    stillBelow.moveTo(5000 - 2800);
    watcher.enter(landedOn);

    expect(landedOn.dataset.reveal).toBe("in");
    expect(passed.dataset.reveal).toBeUndefined();
    expect(stillBelow.dataset.reveal).toBe("wait");
    // It is done with: a late report does not animate it.
    watcher.enter(passed);
    expect(passed.dataset.reveal).toBeUndefined();
  });

  it("does not replay a section that is reported in view again", () => {
    const below = section(2000);
    const watcher = fakeWatcher();
    bindScrollReveal([below], SCREEN, watcher.watch);

    watcher.enter(below);
    // Something else (a later cleanup, say) cleared the mark; a second report must not put it back.
    delete below.dataset.reveal;
    watcher.enter(below);
    expect(below.dataset.reveal).toBeUndefined();
  });

  it("ignores a report for a section it is not holding", () => {
    const onScreen = section(100);
    const watcher = fakeWatcher();
    bindScrollReveal([onScreen], SCREEN, watcher.watch);

    watcher.enter(onScreen);
    expect(onScreen.dataset.reveal).toBeUndefined();
  });

  it("leaves a section that another part of the page already holds", () => {
    const shared = section(2000);
    const first = fakeWatcher();
    const second = fakeWatcher();
    const stopFirst = bindScrollReveal([shared], SCREEN, first.watch);
    const stopSecond = bindScrollReveal([shared], SCREEN, second.watch);

    expect(second.watched.size).toBe(0);
    // Stopping the one that does not hold it changes nothing.
    stopSecond();
    expect(shared.dataset.reveal).toBe("wait");
    stopFirst();
    expect(shared.dataset.reveal).toBeUndefined();
  });

  it("shows everything again when it stops", () => {
    const waiting = section(2000);
    const revealed = section(3000);
    const watcher = fakeWatcher();
    const stop = bindScrollReveal([waiting, revealed], SCREEN, watcher.watch);
    watcher.enter(revealed);

    stop();
    expect(watcher.isDisconnected()).toBe(true);
    expect(waiting.dataset.reveal).toBeUndefined();
    expect(revealed.dataset.reveal).toBeUndefined();
    // A late report after stopping hides nothing and replays nothing.
    watcher.enter(waiting);
    expect(waiting.dataset.reveal).toBeUndefined();
  });
});

/** Every stylesheet under src. */
function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return stylesheets(file);
    return name.endsWith(".css") ? [file] : [];
  });
}

describe("reduced motion in the stylesheets", () => {
  const files = stylesheets(path.join(process.cwd(), "src"));

  // An animation tied to the scroll position ignores animation-duration, so
  // the site-wide reduced-motion rule cannot stop it, and it leaves a section
  // half transparent wherever the page comes to rest.
  it("has no scroll-driven animations", () => {
    const found = files.filter((file) => /animation-timeline|scroll-timeline|view-timeline/.test(readFileSync(file, "utf8")));
    expect(found.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("only hides a waiting section outside print and reduced motion", () => {
    const motion = readFileSync(path.join(process.cwd(), "src/styles/motion.css"), "utf8");
    expect(motion).toMatch(/\[data-reveal="wait"\]\s*{\s*opacity:\s*0;\s*}/);
    expect(motion).toMatch(/@media print, \(prefers-reduced-motion: reduce\)\s*{\s*\[data-reveal="wait"\]\s*{\s*opacity:\s*1;\s*}\s*}/);
  });

  it("turns smooth scrolling off for reduced motion", () => {
    const globals = readFileSync(path.join(process.cwd(), "src/styles/globals.css"), "utf8");
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*html\s*{\s*scroll-behavior:\s*auto;/);
  });

  it("lets the visitor's setting decide how every page-started scroll moves", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) return sources(file);
        return /\.tsx?$/.test(name) ? [file] : [];
      });
    const fixed = sources(path.join(process.cwd(), "src")).filter((file) => /behavior:\s*["']smooth["']/.test(readFileSync(file, "utf8")));
    expect(fixed.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });
});
