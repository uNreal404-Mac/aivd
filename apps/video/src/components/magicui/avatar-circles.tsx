"use client";

import { cn } from "@/components/ui";

interface Avatar {
  imageUrl: string;
  profileUrl: string;
}
interface AvatarCirclesProps {
  className?: string;
  numPeople?: number;
  avatarUrls: Avatar[];
}

export const AvatarCircles = ({
  numPeople,
  className,
  avatarUrls,
}: AvatarCirclesProps) => {
  return (
    <div className={cn("z-10 flex -space-x-4 rtl:space-x-reverse", className)}>
      {avatarUrls.map((url, index) => (
        <a
          key={index}
          href={url.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            key={index}
            className="h-10 w-10 rounded-full border-2 border-[var(--du-border)] dark:border-[var(--du-border-strong)]"
            src={url.imageUrl}
            width={40}
            height={40}
            alt={`Avatar ${index + 1}`}
          />
        </a>
      ))}
      {(numPeople ?? 0) > 0 && (
        <a
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--du-border)] bg-[var(--du-bg)] text-center text-xs font-medium text-[var(--du-text)] hover:bg-[var(--du-surface-2)] dark:border-[var(--du-border-strong)] dark:bg-[var(--du-text)] dark:text-[var(--du-bg)]"
          href=""
        >
          +{numPeople}
        </a>
      )}
    </div>
  );
};
