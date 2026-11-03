# Optical Engine

`scene.html` contains the original Three.js lens assembly, its iris leaves, the procedural studio reflection map and the loop animation. The frame phase runs from 0 through 239/240. The next frame is phase 0.

The renderer needs the application's installed `three` dependency, Node.js, Playwright with a WebGL-capable Chromium browser, and FFmpeg built with `libx264` and `libwebp`. It serves the scene and Three.js module from memory and renders without remote assets.

From the application directory, run:

```sh
node design/cutroom-optics/render.cjs --still /tmp/optical-engine-preview
node design/cutroom-optics/render.cjs /tmp/optical-engine-final
```

When Playwright is installed separately, set `PLAYWRIGHT_MODULE` to its package directory. Set `CHROME_BIN` to select a local Chrome executable and `FFMPEG_PATH` to select an FFmpeg binary.

The full run writes `cutroom-optics.mp4` and `cutroom-optics.webp` into the supplied directory. The silent video is 1600 × 800 at 24 frames per second and lasts 10 seconds. The poster uses the first rendered frame. Intermediate frames are generated in a temporary directory and removed after encoding.

To replace the homepage assets, copy the reviewed outputs into `public/home`. The timeline strip uses video frames 15, 45, 75, 105, 135, 165, 195 and 225.
