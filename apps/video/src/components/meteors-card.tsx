import { Meteors } from "@/components/ui/meteors";

import type { Meteor } from "@/types/meteors";

export function Meteorss({ meteor }: { meteor: Meteor }) {
  return (
    <div className="w-full">
      <div className="relative w-full">
        <div className="absolute inset-0 h-full w-full scale-[0.80] transform rounded-full bg-[var(--du-danger)] bg-gradient-to-r from-[var(--du-accent)] to-[var(--du-accent-2)] blur-3xl" />
        <div className="relative flex h-full flex-col items-start justify-end overflow-hidden rounded-2xl border border-[var(--du-border)] px-4 py-8 shadow-xl dark:bg-[var(--du-surface)] dark:bg-opacity-70">
          <h1 className="relative z-50 mb-4 text-2xl font-bold">
            {meteor.name}
          </h1>

          <p className="light:text-[var(--du-text-dim)] relative z-50 mb-4 text-base font-normal dark:text-[var(--du-text-muted)]">
            {meteor.description}
          </p>
          <a href={meteor.url} target="_blank" rel="noopener noreferrer">
            <button
              type="button"
              className="light:text-[var(--du-text-muted)] rounded-lg border border-[var(--du-border-strong)] px-4 py-1 dark:text-[var(--du-text-muted)]"
            >
              {meteor.button_content}
            </button>

            {/* Meaty part - Meteor effect */}
            <Meteors number={20} />
          </a>
        </div>
      </div>
    </div>
  );
}
