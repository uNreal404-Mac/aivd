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
    gradient:
      'radial-gradient(120% 120% at 15% 20%, rgba(209,254,23,0.18) 0%, rgba(209,254,23,0) 55%), linear-gradient(135deg, #1C1E21 0%, #131517 60%, #0F1113 100%)',
  },
  {
    title: 'Image to Video',
    subtitle: 'Animate a still frame with natural motion.',
    href: '/image-to-video',
    gradient:
      'radial-gradient(120% 120% at 85% 15%, rgba(209,254,23,0.14) 0%, rgba(209,254,23,0) 50%), linear-gradient(160deg, #23262A 0%, #18191C 55%, #0F1113 100%)',
  },
  {
    title: 'Reference to Video',
    subtitle: 'Match a look, a face, or a whole scene.',
    href: '/reference-to-video',
    gradient:
      'radial-gradient(100% 100% at 50% 100%, rgba(209,254,23,0.12) 0%, rgba(209,254,23,0) 60%), linear-gradient(200deg, #1C1E20 0%, #131517 50%, #000000 100%)',
  },
  {
    title: 'Motion Library',
    subtitle: 'Reusable camera moves and transitions.',
    soon: true,
    gradient:
      'radial-gradient(120% 120% at 20% 80%, rgba(209,254,23,0.1) 0%, rgba(209,254,23,0) 55%), linear-gradient(120deg, #18191C 0%, #131517 60%, #0F1113 100%)',
  },
];

const TOOLS: ToolCard[] = [
  {
    title: 'Text to Video',
    description: 'Describe a scene and turn it into a video clip.',
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
    gradient:
      'radial-gradient(120% 120% at 30% 20%, rgba(209,254,23,0.2) 0%, rgba(209,254,23,0) 55%), linear-gradient(160deg, #23262A 0%, #131517 60%, #0F1113 100%)',
  },
  {
    title: 'Soft studio light',
    gradient:
      'radial-gradient(120% 120% at 70% 30%, rgba(209,254,23,0.12) 0%, rgba(209,254,23,0) 50%), linear-gradient(140deg, #1C1E21 0%, #18191C 55%, #0F1113 100%)',
  },
  {
    title: 'Analog film grain',
    gradient:
      'radial-gradient(100% 100% at 50% 90%, rgba(209,254,23,0.1) 0%, rgba(209,254,23,0) 60%), linear-gradient(200deg, #1C1E20 0%, #131517 50%, #000000 100%)',
  },
  {
    title: 'Slow dolly push',
    gradient:
      'radial-gradient(120% 120% at 20% 70%, rgba(209,254,23,0.14) 0%, rgba(209,254,23,0) 55%), linear-gradient(120deg, #18191C 0%, #131517 60%, #0F1113 100%)',
  },
  {
    title: 'Golden hour haze',
    gradient:
      'radial-gradient(120% 120% at 80% 20%, rgba(209,254,23,0.16) 0%, rgba(209,254,23,0) 50%), linear-gradient(150deg, #23262A 0%, #1C1E20 55%, #0F1113 100%)',
  },
  {
    title: 'Deep space orbit',
    gradient:
      'radial-gradient(100% 100% at 50% 50%, rgba(209,254,23,0.08) 0%, rgba(209,254,23,0) 60%), linear-gradient(180deg, #131517 0%, #0F1113 60%, #000000 100%)',
  },
  {
    title: 'Handheld energy',
    gradient:
      'radial-gradient(120% 120% at 25% 25%, rgba(209,254,23,0.18) 0%, rgba(209,254,23,0) 55%), linear-gradient(135deg, #1C1E21 0%, #18191C 60%, #0F1113 100%)',
  },
  {
    title: 'Minimal product spin',
    gradient:
      'radial-gradient(120% 120% at 75% 75%, rgba(209,254,23,0.12) 0%, rgba(209,254,23,0) 50%), linear-gradient(210deg, #23262A 0%, #131517 55%, #0F1113 100%)',
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
    <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-white/80">
      DEMO
    </span>
  );
}

function SoonChip() {
  return (
    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#898A8B]">
      Soon
    </span>
  );
}

export function HfExploreHome({ lang }: { lang: string }) {
  return (
    <div className="w-full px-4 pb-16">
      <header className="pt-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-[-0.04em] text-[#F7F7F8] sm:text-[32px]">
          Explore DreamUtopia
        </h1>
        <p className="mt-1 text-sm text-[#898A8B]">
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
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-base font-bold uppercase tracking-[-0.04em] text-[#F7F7F8]">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-[#898A8B]">{card.subtitle}</p>
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
        <div className="relative flex h-[272px] w-full shrink-0 flex-col justify-center overflow-hidden rounded-[20px] bg-[#1C1E20] p-6 lg:w-[600px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 120% at 90% 20%, rgba(209,254,23,0.16) 0%, rgba(209,254,23,0) 55%), linear-gradient(120deg, #1C1E20 0%, #131517 60%, #0F1113 100%)',
            }}
          />
          <div className="relative">
            <h2 className="font-[family-name:var(--font-display)] text-[36px] font-bold uppercase leading-[1.05] tracking-[-0.04em] text-[#F7F7F8]">
              Start creating
              <br />
              <span className="text-[#D1FE17]">with free credits</span>
            </h2>
            <ul className="mt-4 space-y-1.5">
              {CHECKLIST.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-xs text-[#898A8B]"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#D1FE17]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={`/${lang}/text-to-video`}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#D1FE17] px-4 text-sm font-semibold text-[#1A1A1A]"
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
                  <Icon className="h-5 w-5 text-[#F7F7F8]" />
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#898A8B]">
                    {tool.tag}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#F7F7F8]">
                    {tool.title}
                  </h3>
                  {tool.chip ? (
                    <span className="rounded-md bg-[#D1FE17] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#131517]">
                      {tool.chip}
                    </span>
                  ) : null}
                  {tool.soon ? <SoonChip /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#898A8B]">
                  {tool.description}
                </p>
              </>
            );

            if (tool.soon) {
              return (
                <div
                  key={tool.title}
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-[16px] bg-[#1C1E21] p-4 opacity-60"
                >
                  {body}
                </div>
              );
            }

            return (
              <Link
                key={tool.title}
                href={`/${lang}${tool.href}`}
                className="rounded-[16px] bg-[#1C1E21] p-4 transition-colors hover:bg-[#23262A]"
              >
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-[-0.04em] text-[#F7F7F8]">
            Trending styles
          </h2>
          <Link
            href={`/${lang}/text-to-video`}
            className="text-sm font-medium text-[#D1FE17]"
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
              <p className="mt-2 text-xs text-[#898A8B]">{tile.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-[-0.04em] text-[#F7F7F8]">
          How it works
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-[16px] bg-[#1C1E21] p-4"
            >
              <span className="font-mono text-[10px] font-semibold uppercase text-[#D1FE17]">
                {`0${index + 1}`}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-[#F7F7F8]">
                {step.title}
              </h3>
              <p className="mt-1 text-xs text-[#898A8B]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
