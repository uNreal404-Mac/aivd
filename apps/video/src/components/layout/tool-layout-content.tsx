"use client";

import { HfTopNav } from "@/components/hf/top-nav";

interface ToolLayoutContentProps {
  children: React.ReactNode;
  lang: string;
  user: any;
}

export function ToolLayoutContent({
  children,
  lang,
  user,
}: ToolLayoutContentProps) {
  return (
    <div className="min-h-screen bg-background">
      <HfTopNav
        user={
          user
            ? { name: user.name, email: user.email, image: user.image }
            : null
        }
        lang={lang}
      />

      <div className="flex lg:h-[calc(100svh-52px)]">
        <div className="flex flex-1 min-w-0 lg:overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
