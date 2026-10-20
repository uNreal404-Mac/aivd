"use client";

// ============================================
// Creation Filter Component
// ============================================

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/ui";
import type { VideoFilterOptions, VideoStatus } from "@/lib/types/dashboard";

interface CreationFilterProps {
  filter: VideoFilterOptions;
  onFilterChange: (filter: Partial<VideoFilterOptions>) => void;
}

const availableModels = [
  { value: "all", label: "All Models" },
  { value: "sora-2", label: "Sora 2" },
  { value: "veo-3-1", label: "Veo 3.1" },
  { value: "seedance-1-5", label: "Seedance 1.5" },
  { value: "wan-2-6", label: "Wan 2.6" },
];

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "generating", label: "Generating" },
  { value: "failed", label: "Failed" },
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export function CreationFilter({ filter, onFilterChange }: CreationFilterProps) {
  const t = useTranslations("dashboard.myCreations.filter");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Filter */}
      <div className="flex items-center gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">
        {statusOptions.map((option) => {
          const isActive = (filter.status || "all") === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                onFilterChange({ status: option.value as VideoStatus | "all" })
              }
              className={cn(
                "h-8 rounded-lg px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--du-accent)] text-[var(--du-on-accent)]"
                  : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"
              )}
            >
              {t(option.value as any)}
            </button>
          );
        })}
      </div>

      {/* Model Filter */}
      <Select
        value={filter.model || "all"}
        onValueChange={(value) => onFilterChange({ model: value as string | "all" })}
      >
        <SelectTrigger className="h-10 w-[140px] rounded-xl border border-[var(--du-border)] bg-[var(--du-surface)] text-sm text-[var(--du-text)] hover:bg-[var(--du-surface-2)]">
          <SelectValue placeholder={t("allModels")} />
        </SelectTrigger>
        <SelectContent>
          {availableModels.map((model) => (
            <SelectItem key={model.value} value={model.value}>
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort Order */}
      <Select
        value={filter.sortBy || "newest"}
        onValueChange={(value) => onFilterChange({ sortBy: value as "newest" | "oldest" })}
      >
        <SelectTrigger className="h-10 w-[120px] rounded-xl border border-[var(--du-border)] bg-[var(--du-surface)] text-sm text-[var(--du-text)] hover:bg-[var(--du-surface-2)]">
          <SelectValue placeholder={t("newest")} />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.value as any)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
