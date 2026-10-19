"use client";

// ============================================
// Creation Grid Component
// ============================================

import { cn } from "@/components/ui";

interface CreationGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Dense gallery grid for video cards
 * - Mobile: 2 columns
 * - Tablet: 3 columns
 * - Desktop: 4 columns
 * - Wide desktop: 5 columns
 */
export function CreationGrid({ children, className }: CreationGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2",
        "sm:grid-cols-3",
        "lg:grid-cols-4",
        "2xl:grid-cols-5",
        className
      )}
    >
      {children}
    </div>
  );
}
