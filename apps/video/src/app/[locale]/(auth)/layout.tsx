import type { Metadata } from "next";

import { NOINDEX_ROBOTS } from "@/lib/indexing";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <div className="min-h-screen">{children}</div>;
}
