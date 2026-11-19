"use client";

import { useRouter } from "next/navigation";
import { localizedHref } from "@/lib/locale-path";
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
        router.push(localizedHref(lang, "/"));
        router.refresh();
      }}
    >
      <LogOut aria-hidden="true" />
      {label}
    </button>
  );
}
