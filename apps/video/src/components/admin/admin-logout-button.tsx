"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AdminLogoutButton({ locale }: { locale: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/v1/admin/session", { method: "DELETE" });
        } finally {
          router.replace(`/${locale}/admin-login`);
          router.refresh();
        }
      }}
    >
      {loading ? "退出中…" : "安全退出"}
    </Button>
  );
}
