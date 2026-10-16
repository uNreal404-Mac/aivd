import { cn } from "@/components/ui";
import React from "react";

interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const RainbowButton = React.forwardRef<
  HTMLButtonElement,
  RainbowButtonProps
>(({ children, className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "group relative inline-flex h-11 animate-rainbow cursor-pointer items-center justify-center rounded-xl border-0 bg-[length:200%] px-8 py-2 font-medium text-primary-foreground transition-colors [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        // before styles
        "before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] before:[filter:blur(calc(0.8*1rem))]",
        // light mode colors
        "bg-[linear-gradient(var(--du-text),var(--du-text)),linear-gradient(var(--du-text)_50%,color-mix(in_srgb,var(--du-text)_60%,transparent)_80%,transparent),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))]",
        // dark mode colors
        "dark:bg-[linear-gradient(var(--du-text),var(--du-text)),linear-gradient(var(--du-text)_50%,color-mix(in_srgb,var(--du-text)_60%,transparent)_80%,transparent),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

RainbowButton.displayName = "RainbowButton";
