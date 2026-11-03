# aidv.ai · Interface design

Read this before changing a screen. Show the footage first. A visitor should be able to write a shot, inspect real examples, and enter the existing studio without choosing between competing signup offers.

## Colour and type

| Role | Token | Value |
|---|---|---|
| Canvas / elevated canvas | `--du-bg` / `--du-bg-elev` | #000000 / #0B0C10 |
| Surface | `--du-surface` | #0B0C10; use spacing or a single thin border to separate it |
| Primary / secondary text | `--du-text` / `--du-text-muted` | #C5C6C7 / existing muted variant |
| Primary action / hover | `--du-accent` / `--du-accent-hover` | #66FCF1 / #45A29E; black label |
| Dividers | `--du-surface-2` / `--du-border` | existing #1F2833 family |

Accent is reserved for the primary action, keyboard focus and selected states. Do not introduce or recolor a palette variable. Only layout dimensions may use new tokens. Video and photography retain their original colour. Never mock a missing thumbnail with a purple or blue gradient. A neutral scrim over real footage may protect text contrast.

Use Space Grotesk for display headings and Inter for body, served by Next Font from the site origin. CJK uses the native system sans fallback. Type sizes are desktop / mobile: H1 88 / 48 px (fluid), H2 56 / 32 px, H3 24 / 20 px, body 16 / 16 px, caption 13 / 13 px. Body leading is 1.5; display leading is 0.98–1.08. Preserve the existing localized H1, document titles, descriptions and language alternates.

## Layout

Work on an 8px grid. Limit the content container to 1440px including gutters (desktop 64px, mobile 16px). Footage may bleed to the viewport. Separate peer sections with 120px on desktop and 64px on mobile; use one shared gap so adjacent sections never double it. Leave room for safe areas. Never cause document-level horizontal scrolling: horizontal reels scroll inside their own labelled region.

## Components and copy

* **Button:** primary is the solid teal, black-label `.du-primary`, minimum height 48px, consistent radius and visible focus. Secondary is a neutral outline; ghost is text with an underline or subtle hover. Do not style incidental links as primary. Use semantic links for navigation, buttons for local state.
* **Card:** one surface, one destination and one accessible name. No card inside card, nested links, repeated “Try it” or “Learn more”. Arrange dense model cards in mobile pairs.
* **MediaTile:** deliver a real local WebP poster with explicit aspect ratio. Images below the fold load lazily. Optional muted video loads on deliberate hover/focus on a fine pointer; stop on exit and respect reduced motion. On touch the tile itself opens its destination. Omit unavailable work; do not print an empty loading section.
* **Badge:** small, readable text with a restrained border; for useful information like billing savings. HOT is an editorial designation for an existing featured model; NEW requires an available model actually marked new. No decorative Preview/Soon labels in the navigation.
* **Primary action:** always “Create Video Free” / “免费创作视频”. It opens the existing text-to-video flow; a prompt is carried there without submitting a generation. The PromptBox submit uses the specific exception “Generate · N credits” / “生成 · N 积分”, with the existing billing calculator for the matching model, duration and quality. The home content has four placements: hero form submit, after templates, long-form film, final invitation. The nav CTA uses the same words as a ghost link; mobile sticky is a contextual substitute for the hero action, not a second sticky header CTA. Product-specific checkout labels describe the actual purchase; only Pro gets the primary treatment.

The marketing header is Create, Templates, Gallery, Pricing, Login and the creation action. Use the official logo asset in the header and footer. Showcase photography, not gradients or decorative editing interfaces. Report before/after evidence at 1440 and 390 pixels.

**PromptBox / Optical Engine:** keep the optical film monitor and real storyboard above the fold. The multiline editor sits after the preserved H1 and before the timeline. Text and image modes hand drafts to the matching existing tool. Show no anonymous/free-render promise. On small screens load the priority poster only; playing the film requires a deliberate action.
