"use client";

// ============================================
// Avatar Fallback Component
// ============================================

import { cn } from "@/components/ui";

interface AvatarFallbackProps {
  name?: string | null;
  email?: string;
  className?: string;
}

// 预定义主题色数组
const colors = [
  "var(--du-accent)",              // 主题色
  "var(--du-accent-2)",            // 紫色
  "var(--du-accent-text)",         // 蓝色
  "var(--du-success)",             // 绿色
  "var(--du-warning)",             // 橙色
  "var(--du-danger)",              // 粉色
  "var(--du-accent-hover)",        // 青色
];

/**
 * 获取首字母
 */
function getInitial(name?: string | null, email?: string): string {
  if (name) {
    return name.charAt(0).toUpperCase();
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return "?";
}

/**
 * 根据用户名生成背景色
 */
function getBackgroundColor(name?: string | null, email?: string): string {
  const key = name || email || "?";
  const index = key.charCodeAt(0) % colors.length;
  return colors[index];
}

export function AvatarFallback({ name, email, className }: AvatarFallbackProps) {
  const initial = getInitial(name, email);
  const backgroundColor = getBackgroundColor(name, email);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-[var(--du-on-accent)] font-semibold",
        "bg-gradient-to-br from-primary to-primary/80",
        className
      )}
      style={{ backgroundColor }}
    >
      {initial}
    </div>
  );
}
