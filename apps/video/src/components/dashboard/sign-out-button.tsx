"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export function SignOutButton({ lang, label }: { lang: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="db-btn"
      onClick={async () => {
        await authClient.signOut();
        router.push(`/${lang}`);
        router.refresh();
      }}
    >
      <LogOut aria-hidden="true" />
      {label}
    </button>
  );
}
