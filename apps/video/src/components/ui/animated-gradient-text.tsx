import type { ReactNode } from "react";

import { cn } from "./utils/cn";

function AnimatedGradientText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex max-w-fit flex-row items-center justify-center rounded-2xl bg-[var(--du-glass-bg)] px-4 py-1.5 text-sm font-medium shadow-[var(--du-glass-shadow)] backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%] hover:shadow-[var(--du-glow)] dark:bg-[var(--du-glass-bg-strong)]",
        className,
      )}
    >
      <div
        className={`animate-gradient absolute inset-0 block h-full w-full bg-gradient-to-r from-[var(--du-accent)]/50 via-[var(--du-accent-2)]/50 to-[var(--du-accent)]/50 bg-[length:var(--bg-size)_100%] p-[1px] ![mask-composite:subtract] [border-radius:inherit] [mask:linear-gradient(var(--du-text)_0_0)_content-box,linear-gradient(var(--du-text)_0_0)]`}
      />

      {children}
    </div>
  );
}

export { AnimatedGradientText };
