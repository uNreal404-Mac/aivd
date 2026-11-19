"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { StateBlock } from "@/components/states/state-block";

/** What a route shows when rendering it throws: a retry and a way home. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const zh = locale.toLowerCase().startsWith("zh");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <StateBlock
        tone="error"
        icon={TriangleAlert}
        title={zh ? "页面出了点问题" : "Something went wrong"}
        body={
          zh
            ? "这个页面没能正常加载。你的积分和作品不受影响，重试一下通常就好了。"
            : "This page did not load properly. Your credits and creations are safe; trying again usually fixes it."
        }
        detail={error.digest ? `${zh ? "错误编号" : "Reference"}: ${error.digest}` : undefined}
        actions={[
          { label: zh ? "重试" : "Try again", onClick: reset, icon: RotateCcw, primary: true },
          { label: zh ? "回到首页" : "Go home", href: `/${locale}`, icon: Home },
        ]}
      />
    </div>
  );
}
