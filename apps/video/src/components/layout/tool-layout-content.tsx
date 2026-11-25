"use client";

import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  if (pathname?.replace(/\/$/, "").endsWith("/creative-space/canvas")) return <main className="w-full">{children}</main>;
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

      <div className="flex lg:h-[calc(100svh-var(--hf-header-h,56px))]">
        <main className="flex flex-1 min-w-0 lg:overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
