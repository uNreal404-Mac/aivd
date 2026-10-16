/**
 * Demo Videos
 *
 * 空状态占位视频展示
 * - 单个示例视频
 */

import { Play } from "lucide-react";
import { cn } from "@/components/ui";

export function DemoVideos({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-[var(--du-accent)]/20 to-[var(--du-accent-2)]/20 border border-[var(--du-border)] relative group">
        {/* 播放图标 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--du-glass-bg)] backdrop-blur-sm border border-[var(--du-glass-border)] group-hover:scale-110 transition-transform">
            <Play className="w-8 h-8 text-[var(--du-text)] ml-1" />
          </div>
        </div>

        {/* 悬停遮罩 */}
        <div className="absolute inset-0 bg-[var(--du-glass-overlay-scrim)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
