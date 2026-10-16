import { Card } from "@/components/ui/card"
import * as Icons from "@/components/ui/icons";

export function FeaturesGrid({ dict } : { dict: Record<string, string> | undefined }) {
  return (
    <div className="flex gap-4 flex-col sm:flex-row md:flex-row xl:flex-row">
      <Card className="p-3 w-full rounded-3xl dark:border-[var(--du-border)] dark:bg-[var(--du-surface)]/40">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--du-accent-soft)] flex items-center justify-center">
              <Icons.Blocks className="w-6 h-6 text-[var(--du-accent)]" />
            </div>
            <h2 className="text-lg font-semibold">{dict?.monorepo_title}</h2>
          </div>
          <p className="leading-relaxed text-[var(--du-text-muted)] dark:text-[var(--du-text-muted)] font-medium">
            {dict?.monorepo_desc}
          </p>
        </div>
      </Card>

      <Card className="p-3 w-full rounded-3xl dark:border-[var(--du-border)] dark:bg-[var(--du-surface)]/40">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--du-accent-soft)] flex items-center justify-center">
              <Icons.Languages className="w-6 h-6 text-[var(--du-accent)]" />
            </div>
            <h2 className="text-lg font-semibold">{dict?.i18n_title}</h2>
          </div>
          <p className="leading-relaxed text-[var(--du-text-muted)] dark:text-[var(--du-text-muted)] font-medium">
            {dict?.i18n_desc}
          </p>
        </div>
      </Card>

      <Card className="p-3 w-full rounded-3xl dark:border-[var(--du-border)] dark:bg-[var(--du-surface)]/40">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--du-accent-soft)] flex items-center justify-center">
              <Icons.Billing className="w-6 h-6 text-[var(--du-accent)]" />
            </div>
            <h2 className="text-lg font-semibold">{dict?.payments_title}</h2>
          </div>
          <p className="leading-relaxed text-[var(--du-text-muted)] dark:text-[var(--du-text-muted)] font-medium">
            {dict?.payments_desc}
          </p>
        </div>
      </Card>

      <Card className="p-3 w-full rounded-3xl dark:border-[var(--du-border)] dark:bg-[var(--du-surface)]/40">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--du-accent-soft)] flex items-center justify-center">
              <Icons.ShieldCheck className="w-6 h-6 text-[var(--du-accent)]" />
            </div>
            <h2 className="text-lg font-semibold">{dict?.nextauth_title}</h2>
          </div>
          <p className="leading-relaxed text-[var(--du-text-muted)] dark:text-[var(--du-text-muted)] font-medium">
            {dict?.nextauth_desc}
          </p>
        </div>
      </Card>
    </div>
  )
}
