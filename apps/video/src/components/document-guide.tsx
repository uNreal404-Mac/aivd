import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/components/ui";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

export function DocumentGuide({ children }: { children: ReactNode }) {
  return (
    <AnimatedGradientText>
      🚀 <hr className="mx-2 h-4 w-[1px] shrink-0 bg-[var(--du-border-strong)]" />{" "}
      <span
        className={cn(
          `animate-gradient inline bg-gradient-to-r from-[var(--du-accent)] via-[var(--du-accent-2)] to-[var(--du-accent)] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent`,
        )}
      >
        {children}
      </span>
      <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
    </AnimatedGradientText>
  );
}
