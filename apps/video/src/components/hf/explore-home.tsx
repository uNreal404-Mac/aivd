import Link from 'next/link';
import {
  ArrowRight,
  AudioLines,
  Check,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Type,
} from 'lucide-react';

type FeaturedCard = {
  title: string;
  subtitle: string;
  href?: string;
  soon?: boolean;
  gradient: string;
};

type ToolCard = {
  title: string;
  description: string;
  href?: string;
  soon?: boolean;
  tag: string;
  chip?: 'TOP' | 'NEW';
  icon: typeof Type;
};

type StyleTile = {
  title: string;
  gradient: string;
};

const FEATURED: FeaturedCard[] = [
  {
    title: 'Text to Video',
    subtitle: 'Turn a written prompt into a finished clip.',
    href: '/text-to-video',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Image to Video',
    subtitle: 'Animate a still frame with natural motion.',
    href: '/image-to-video',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Reference to Video',
    subtitle: 'Match a look, a face, or a whole scene.',
    href: '/reference-to-video',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Motion Library',
    subtitle: 'Reusable camera moves and transitions.',
    soon: true,
    gradient: 'var(--du-surface-2)',
  },
];

const TOOLS: ToolCard[] = [
  {
    title: 'Text to Video',
    description: 'Describe a scene and render it in seconds.',
    href: '/text-to-video',
    tag: 'Video',
    chip: 'TOP',
    icon: Type,
  },
  {
    title: 'Image to Video',
    description: 'Bring any still image to life with motion.',
    href: '/image-to-video',
    tag: 'Video',
    icon: ImageIcon,
  },
  {
    title: 'Reference to Video',
    description: 'Guide the output with a reference clip.',
    href: '/reference-to-video',
    tag: 'Video',
    chip: 'NEW',
    icon: Layers,
  },
  {
    title: 'My creations',
    description: 'Browse and reuse everything you have made.',
    href: '/my-creations',
    tag: 'Library',
    icon: FolderOpen,
  },
  {
    title: 'Image Generator',
    description: 'Create stills and keyframes from prompts.',
    soon: true,
    tag: 'Image',
    icon: Sparkles,
  },
  {
    title: 'Audio & Voice',
    description: 'Add narration, music, and sound effects.',
    soon: true,
    tag: 'Audio',
    icon: AudioLines,
  },
];

const STYLES: StyleTile[] = [
  {
    title: 'Neon city drift',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Soft studio light',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Analog film grain',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Slow dolly push',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Golden hour haze',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Deep space orbit',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Handheld energy',
    gradient: 'var(--du-surface-2)',
  },
  {
    title: 'Minimal product spin',
    gradient: 'var(--du-surface-2)',
  },
];

const CHECKLIST = [
  'Starter credits on every new account',
  'Several leading video models in one place',
  'Every result saved to My creations',
];

const STEPS = [
  {
    title: 'Describe it',
    body: 'Write a prompt or drop in a reference image, clip, or style.',
  },
  {
    title: 'Generate it',
    body: 'Pick a model and aspect ratio, then render your first take.',
  },
  {
    title: 'Refine it',
    body: 'Adjust motion, length, and framing until it feels right.',
  },
];

function DemoChip() {
  return (
    <span className="absolute left-2 top-2 rounded bg-[var(--du-surface)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--du-text)]">
      DEMO
    </span>
  );
}

function SoonChip() {
  return (
    <span className="rounded-md bg-[var(--du-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--du-text-muted)]">
      Soon
    </span>
  );
}

export function HfExploreHome({ lang }: { lang: string }) {
  return (
    <div className="w-full px-4 pb-16">
      <header className="pt-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--du-text)] sm:text-[32px]">
          Explore aidv.ai
        </h1>
        <p className="mt-1 text-sm text-[var(--du-text-muted)]">
          Generate, animate, and direct video with AI.
        </p>
      </header>

      <section className="mt-6">
        <div className="hf-scroll-x flex snap-x gap-5 overflow-x-auto pb-2">
          {FEATURED.map((card) => {
            const inner = (
              <>
                <div
                  className="relative aspect-[16/7] w-full overflow-hidden rounded-[16px]"
                  style={{ background: card.gradient }}
                >
                  <DemoChip />
                </div>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-base font-bold uppercase tracking-[-0.04em] text-[var(--du-text)]">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--du-text-muted)]">{card.subtitle}</p>
              </>
            );

            if (card.soon) {
              return (
                <div
                  key={card.title}
                  aria-disabled="true"
                  className="w-[300px] shrink-0 cursor-not-allowed snap-start opacity-60 sm:w-[512px]"
                >
                  <div className="relative">
                    {inner}
                    <span className="absolute right-2 top-2">
                      <SoonChip />
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={card.title}
                href={`/${lang}${card.href}`}
                className="w-[300px] shrink-0 snap-start sm:w-[512px]"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-5 lg:flex-row">
        <div className="relative flex h-[272px] w-full shrink-0 flex-col justify-center overflow-hidden rounded-[20px] bg-[var(--du-surface)] p-6 lg:w-[600px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'var(--du-surface)',
            }}
          />
          <div className="relative">
            <h2 className="font-[family-name:var(--font-display)] text-[36px] font-bold uppercase leading-[1.05] tracking-[-0.04em] text-[var(--du-text)]">
              Start creating
              <br />
              <span className="text-[var(--du-accent-text)]">with free credits</span>
            </h2>
            <ul className="mt-4 space-y-1.5">
              {CHECKLIST.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-xs text-[var(--du-text-muted)]"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--du-accent-text)]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={`/${lang}/text-to-video`}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-[var(--du-accent)] px-4 text-sm font-semibold text-[var(--du-on-accent)] hover:bg-[var(--du-accent-hover)]"
            >
              Open the studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const body = (
              <>
                <div className="flex items-start justify-between">
                  <Icon className="h-5 w-5 text-[var(--du-accent-text)]" />
                  <span className="rounded-md bg-[var(--du-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--du-text-muted)]">
                    {tool.tag}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--du-text)]">
                    {tool.title}
                  </h3>
                  {tool.chip ? (
                    <span className="rounded-md bg-[var(--du-accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--du-on-accent)]">
                      {tool.chip}
                    </span>
                  ) : null}
                  {tool.soon ? <SoonChip /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--du-text-muted)]">
                  {tool.description}
                </p>
              </>
            );

            if (tool.soon) {
              return (
                <div
                  key={tool.title}
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-[16px] bg-[var(--du-surface)] p-4 opacity-60"
                >
                  {body}
                </div>
              );
            }

            return (
              <Link
                key={tool.title}
                href={`/${lang}${tool.href}`}
                className="rounded-[16px] bg-[var(--du-surface)] p-4 transition-colors hover:bg-[var(--du-surface-2)]"
              >
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--du-text)]">
            Trending styles
          </h2>
          <Link
            href={`/${lang}/text-to-video`}
            className="text-sm font-medium text-[var(--du-accent-text)]"
          >
            See all
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STYLES.map((tile) => (
            <div key={tile.title}>
              <div
                className="relative aspect-[3/4] w-full overflow-hidden rounded-[12px]"
                style={{ background: tile.gradient }}
              >
                <DemoChip />
              </div>
              <p className="mt-2 text-xs text-[var(--du-text-muted)]">{tile.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--du-text)]">
          How it works
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-[16px] bg-[var(--du-surface)] p-4"
            >
              <span className="font-mono text-[10px] font-semibold uppercase text-[var(--du-accent-text)]">
                {`0${index + 1}`}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-[var(--du-text)]">
                {step.title}
              </h3>
              <p className="mt-1 text-xs text-[var(--du-text-muted)]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
