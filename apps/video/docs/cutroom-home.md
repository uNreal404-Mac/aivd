# Motion Lab homepage

The Chinese and English homepages share one cut room. The rest of the product keeps its existing navigation, localization and studio routes.

* `src/components/hf/cutroom-films.ts` maps each public video, its poster and its **actual** eight-frame contact sheet to localized film titles and shot prompts. Cue start positions are fractions of the decoded duration. The optics film’s source is in `design/cutroom-optics/`.
* `premiere-hero.tsx` uses the native media clock for the scrubber. Scrubbing pauses on the selected frame; closing a clean screening returns that frame to the editing table. The prompt editor keeps a separate draft per shot during the visit. Submission hands the prompt to the existing localized studio using its session-storage contract. It does not start a generation.
* Frame overlays show thirds, a centered 9:16 safe area or a centered 2.39:1 safe area. They only affect the monitor. The film does not autoplay when reduced motion is requested.
* `premiere-collection.tsx` is the storyboard below the monitor. Its stills have individual framing, motion and light notes, and shot-specific tool links.
* This is a branch preview in the existing DreamUtopia Pages project. The primary hostname is not the target for design reviews.

The [Variant design](https://variant.com/shared/cdfed8f9-3555-41c3-afe3-c9fbbceb041b) informed the lower-left film title and selective shot editor. The earlier [baoyu-design](https://github.com/jimliu/baoyu-design) board used the original site identity. The contact sheet and interaction review used the [frontend-design and webapp-testing skill collection](https://github.com/CharlesHarry7/skills-/tree/ca45fc496a3436251f191354091d557da31c15b5/skills).
