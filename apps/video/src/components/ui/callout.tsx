import { cn } from "@/components/ui";

interface CalloutProps {
  icon?: string;
  children?: React.ReactNode;
  type?: "default" | "warning" | "danger" | "info";
}

// ✅💡⚠️🚫🚨
export function Callout({
  children,
  icon,
  type = "default",
  ...props
}: CalloutProps) {
  return (
    <div
      className={cn("mt-6 flex items-start rounded-md border px-4 py-3", {
        "border-[var(--du-accent)]/40 bg-[var(--du-accent-soft)] text-[var(--du-accent-text)] dark:border-[var(--du-accent)]/40 dark:bg-[var(--du-accent)]/20 dark:text-[var(--du-accent-text)]":
          type === "info",
        "border-[var(--du-danger)]/40 bg-[var(--du-danger)]/20 text-[var(--du-danger)] dark:border-[var(--du-danger)]/30 dark:bg-[var(--du-danger)]/20 dark:text-[var(--du-danger)]":
          type === "danger",
        "border-[var(--du-warning)]/40 bg-[var(--du-warning)]/20 text-[var(--du-warning)] dark:border-[var(--du-warning)]/30 dark:bg-[var(--du-warning)]/20 dark:text-[var(--du-warning)]":
          type === "warning",
      })}
      {...props}
    >
      {icon && <span className="mr-3 text-xl">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}
