const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const framesPerSecond = 24;
const frameCount = 240;
const viewport = { width: 1600, height: 800 };

async function drawFrames(directory, posterOnly) {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const threeModule = path.join(
    path.dirname(require.resolve("three")),
    "three.module.js",
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BIN || undefined,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      ...(process.platform === "darwin" ? ["--use-angle=metal"] : []),
    ],
  });
  try {
    const page = await browser.newPage({ viewport });
    const resources = new Map([
      [
        "/",
        ["text/html", await fs.readFile(path.join(__dirname, "scene.html"))],
      ],
      ["/three.js", ["text/javascript", await fs.readFile(threeModule)]],
    ]);
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      const resource = resources.get(url.pathname);
      if (url.origin !== "http://optics.test" || !resource)
        return route.abort();
      return route.fulfill({
        status: 200,
        contentType: resource[0],
        body: resource[1],
      });
    });
    page.on("pageerror", (error) => console.error(error.message));
    await page.goto("http://optics.test/");
    await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
    const count = posterOnly ? 1 : frameCount;
    for (let index = 0; index < count; index++) {
      const jpeg = await page.evaluate((phase) => {
        window.frameAt(phase);
        return document
          .querySelector("canvas")
          .toDataURL("image/jpeg", 0.965)
          .split(",")[1];
      }, index / frameCount);
      const name = String(index).padStart(4, "0") + ".jpg";
      await fs.writeFile(
        path.join(directory, name),
        Buffer.from(jpeg, "base64"),
      );
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const posterOnly = args.includes("--still");
  const destinations = args.filter((arg) => arg !== "--still");
  if (destinations.length !== 1)
    throw new Error("Usage: node render.cjs [--still] OUTPUT_DIRECTORY");
  const output = path.resolve(destinations[0]);
  const frames = await fs.mkdtemp(
    path.join(os.tmpdir(), "cutroom-optics-frames-"),
  );
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const commonArgs = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y"];
  try {
    await fs.mkdir(output, { recursive: true });
    await drawFrames(frames, posterOnly);
    execFileSync(
      ffmpeg,
      [
        ...commonArgs,
        "-i",
        path.join(frames, "0000.jpg"),
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        "90",
        "-compression_level",
        "6",
        path.join(output, "cutroom-optics.webp"),
      ],
      { stdio: "inherit" },
    );
    if (!posterOnly) {
      execFileSync(
        ffmpeg,
        [
          ...commonArgs,
          "-framerate",
          String(framesPerSecond),
          "-i",
          path.join(frames, "%04d.jpg"),
          "-frames:v",
          String(frameCount),
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "19",
          "-maxrate",
          "3400k",
          "-bufsize",
          "4200k",
          "-pix_fmt",
          "yuv420p",
          "-profile:v",
          "high",
          "-level",
          "4.0",
          "-colorspace",
          "bt709",
          "-color_primaries",
          "bt709",
          "-color_trc",
          "bt709",
          "-movflags",
          "+faststart",
          path.join(output, "cutroom-optics.mp4"),
        ],
        { stdio: "inherit" },
      );
    }
  } finally {
    await fs.rm(frames, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
