"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import {
  CATEGORY_LABELS,
  EFFECT_CATEGORIES,
  EFFECT_TEMPLATES,
  copyFor,
  filterEffects,
  labelFor,
  useHref,
  type EffectsCategory,
} from "@/lib/effects-data";
import "./effects.css";

const S = (name: string) => `/home/samples/${name}.webp`;

/**
 * A library picture for each effect and, for camera and motion effects, the
 * move it makes, played on hover. The pictures illustrate the idea; they are
 * not the effect's output, and the card says so.
 */
const LOOK: Record<string, { image: string; move?: string }> = {
  "slow-push-in": { image: S("red-carpet"), move: "push" },
  "orbit-reveal": { image: S("dancer"), move: "orbit" },
  "crash-zoom": { image: S("planet-impact"), move: "zoom" },
  "dolly-drift": { image: S("studio-room"), move: "drift" },
  "melt-away": { image: S("cosmic-bloom") },
  "paper-fold": { image: S("tomb-light") },
  "liquid-morph": { image: S("storm-sea") },
  "neon-rain": { image: S("rain-couple") },
  "golden-dust": { image: S("autumn-walk") },
  "fog-roll": { image: S("mountain-valley") },
  "ink-wash": { image: S("dreaming") },
  "pixel-pop": { image: S("mech-warrior") },
  claymation: { image: S("boy-and-dog") },
  "float-up": { image: S("mountain-wind"), move: "rise" },
  "wind-sweep": { image: S("autumn-walk"), move: "sweep" },
  "freeze-burst": { image: "/home/hero-marina-poster.webp", move: "freeze" },
};

export function EffectsGallery({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const [category, setCategory] = useState<EffectsCategory>("all");
  const copy = copyFor(lang);
  const items = useMemo(() => filterEffects(EFFECT_TEMPLATES, category), [category]);

  return (
    <div className="fx">
      <fieldset className="fx-chips">
        <legend className="sr-only">{copy.title}</legend>
        {EFFECT_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === category}
            className={item === category ? "fx-chip fx-chip-on" : "fx-chip"}
            onClick={() => setCategory(item)}
          >
            {labelFor(CATEGORY_LABELS[item], lang)}
            <span className="fx-chip-count">{filterEffects(EFFECT_TEMPLATES, item).length}</span>
          </button>
        ))}
      </fieldset>

      {items.length === 0 ? (
        <p className="fx-empty">{copy.empty}</p>
      ) : (
        <ul className="fx-grid">
          {items.map((template) => {
            const name = labelFor(template.name, lang);
            const look = LOOK[template.id] ?? { image: S("cosmic-bloom") };
            return (
              <li key={template.id}>
                <Link href={useHref(lang, template)} className={`fx-card ${look.move ? `fx-move-${look.move}` : ""}`}>
                  <span className="fx-media">
                    <img src={look.image} alt="" loading="lazy" />
                    <span className="fx-tag">{zh ? "示意" : "Illustration"}</span>
                    {template.badge === "new" ? <span className="fx-new">{copy.newBadge}</span> : null}
                    <span className="fx-use">
                      {zh ? "套用特效" : "Use effect"}
                      <ArrowRight aria-hidden="true" />
                    </span>
                  </span>
                  <span className="fx-name">{name}</span>
                  <span className="fx-desc">{labelFor(template.description, lang)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
