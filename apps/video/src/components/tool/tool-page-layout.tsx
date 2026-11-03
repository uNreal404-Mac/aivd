/**
 * Tool Page Layout Component
 *
 * 工具页面统一布局组件
 *
 * 根据工具页面配置动态渲染：
 * - 左侧：生成器面板
 * - 右侧：落地页（未登录）或结果面板（已登录）
 *
 * SEO 友好，支持服务端渲染
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { useCredits } from "@/stores/credits-store";
import { useVideoPolling } from "@/hooks/use-video-polling";
import { useNotificationDeduplication } from "@/hooks/use-notification-deduplication";
import { videoTaskStorage } from "@/lib/video-task-storage";
import { videoHistoryStorage, type VideoHistoryItem } from "@/lib/video-history-storage";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { UpgradeModal } from "@/components/upgrade/upgrade-modal";
import { siteConfig } from "@/config/site";
import type { Video } from "@/db";
import type { ToolPageConfig } from "@/config/tool-pages";
import { GeneratorPanel, type GeneratorData } from "@/components/tool/generator-panel";
import { uploadImage } from "@/lib/video-api";
import { ToolLandingPage } from "@/components/tool/tool-landing-page";
import { VideoHistoryPanel } from "@/components/tool/video-history-panel";
import { HfWorkbenchShell } from "@/components/hf/workbench-shell";
import { toast } from "sonner";

const TOOL_PREFILL_KEY = "videofly_tool_prefill";
const TOOL_PREFILL_NOTICE_KEY = "videofly_tool_prefill_notice";

// ============================================================================
// Types
// ============================================================================

export interface ToolPageLayoutProps {
  /**
   * 工具页面配置
   */
  config: ToolPageConfig;

  /**
   * 工具路由（用于 SEO 和导航）
   */
  toolRoute: string;

  /**
   * 当前语言
   */
  locale: string;
}

// ============================================================================
// ToolPageLayout Component
// ============================================================================

/**
 * ToolPageLayout - 工具页面布局
 *
 * 处理：
 * - 用户登录状态检测
 * - 视频生成流程
 * - 积分检查
 * - 左右面板布局切换
 *
 * @example
 * ```tsx
 * import { getToolPageConfig } from "@/config/tool-pages";
 *
 * export default function ImageToVideoPage({ params }) {
 *   const config = getToolPageConfig("image-to-video");
 *   return <ToolPageLayout config={config} locale={params.locale} toolRoute="image-to-video" />;
 * }
 * ```
 */
export function ToolPageLayout({
  config,
  toolRoute,
  locale,
}: ToolPageLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { balance, optimisticFreeze, optimisticRelease, invalidate } = useCredits();
  const { openModal } = useUpgradeModal();
  const { shouldNotify, markNotified, resetNotification } = useNotificationDeduplication();
  const videoIdFromQuery = searchParams.get("id");
  const NOTIFICATION_ASKED_KEY = "videofly_notification_asked";
  const tNotify = useTranslations("Notifications");
  const tTool = useTranslations("ToolPage");
  const tGallery = useTranslations("Gallery");

  // 状态
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentVideos, setCurrentVideos] = useState<Video[]>([]);
  const [generatingIds, setGeneratingIds] = useState<string[]>([]);
  const [historyItems, setHistoryItems] = useState<VideoHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"generator" | "result">("generator");
  const [prefillData, setPrefillData] = useState<{
    prompt?: string;
    model?: string;
    duration?: number;
    aspectRatio?: string;
    quality?: string;
    imageUrl?: string;
  } | null>(null);
  const [prefillNotice, setPrefillNotice] = useState<{
    modelUnavailable?: boolean;
    originalModel?: string;
    needsOwnImage?: boolean;
  } | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const addGeneratingId = useCallback((videoId: string) => {
    setGeneratingIds((prev) => (prev.includes(videoId) ? prev : [videoId, ...prev]));
  }, []);

  const removeGeneratingId = useCallback((videoId: string) => {
    setGeneratingIds((prev) => prev.filter((id) => id !== videoId));
  }, []);

  const handleCompleted = useCallback(
    (video: Video) => {
      // 更新历史记录
      videoHistoryStorage.updateHistory(
        video.uuid,
        {
          status: "completed",
          videoUrl: video.videoUrl || undefined,
          thumbnailUrl: video.thumbnailUrl || undefined,
          duration: video.duration || undefined,
        },
        user?.id
      );
      setHistoryItems(videoHistoryStorage.getHistory(user?.id));

      // 更新 currentVideos（兼容旧逻辑）
      setCurrentVideos((prev) => {
        const exists = prev.find((v) => v.uuid === video.uuid);
        if (exists) {
          return prev.map((v) => (v.uuid === video.uuid ? video : v));
        }
        return [video, ...prev];
      });
      removeGeneratingId(video.uuid);
      // 刷新积分（生成成功，积分已结算）
      invalidate();
      if (user?.id) {
        videoTaskStorage.updateTask(
          video.uuid,
          { status: "completed" },
          user.id
        );
      }

      // 通知去重：确保只有一个标签页显示通知
      if (!shouldNotify(video.uuid)) {
        return;
      }

      // 准备提示词（截断过长的提示词）
      const promptPreview = video.prompt?.length > 50
        ? `${video.prompt.slice(0, 50)}...`
        : video.prompt || "";

      // 显示通知（浏览器通知或 toast）
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            new Notification(
              tNotify("videoReadyTitle", { siteName: siteConfig.name }),
              {
                body: tNotify("videoReadyBody", { prompt: promptPreview }),
              }
            );
          } catch (error) {
            console.warn("Notification dispatch failed:", error);
            toast.success(
              tNotify("videoReadyTitle", { siteName: siteConfig.name }),
              {
                description: tNotify("videoReadyBody", { prompt: promptPreview }),
              }
            );
          }
        } else {
          toast.success(
            tNotify("videoReadyTitle", { siteName: siteConfig.name }),
            {
              description: promptPreview
                ? tNotify("videoReadyBody", { prompt: promptPreview })
                : tNotify("videoReadyBodyShort"),
            }
          );
        }
      } else {
        toast.success(
          tNotify("videoReadyTitle", { siteName: siteConfig.name }),
          {
            description: promptPreview
              ? tNotify("videoReadyBody", { prompt: promptPreview })
              : tNotify("videoReadyBodyShort"),
          }
        );
      }

      // 标记为已通知，防止其他标签页重复通知
      markNotified(video.uuid);
    },
    [removeGeneratingId, user?.id, invalidate, tNotify, shouldNotify, markNotified]
  );

  const handleFailed = useCallback(
    ({ videoId, error }: { videoId: string; error?: string }) => {
      // 更新历史记录
      videoHistoryStorage.updateHistory(
        videoId,
        {
          status: "failed",
        },
        user?.id
      );
      setHistoryItems(videoHistoryStorage.getHistory(user?.id));

      // 移除生成 ID
      removeGeneratingId(videoId);
      // 刷新积分（生成失败，积分已释放）
      invalidate();
      if (user?.id) {
        videoTaskStorage.updateTask(
          videoId,
          { status: "failed" },
          user.id
        );
      }
      const notificationKey = `${videoId}:failed`;
      if (shouldNotify(notificationKey)) {
        const message = error || "Video generation failed";
        toast.error(message);
        markNotified(notificationKey);
      }
    },
    [removeGeneratingId, user?.id, invalidate, shouldNotify, markNotified]
  );

  const { startPolling, stopPolling, isPolling } = useVideoPolling({
    maxConsecutiveErrors: 3,
    maxBackoffMs: 60000,
    onCompleted: handleCompleted,
    onFailed: handleFailed,
  });

  // 检查登录状态
  useEffect(() => {
    authClient.getSession().then((session) => {
      setUser(session?.data?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(TOOL_PREFILL_KEY);
      const fromLink = new URLSearchParams(window.location.search);
      if (!raw && !fromLink.has("model") && !fromLink.has("prompt")) return;
      const parsed = raw ? JSON.parse(raw) : {
        model: fromLink.get("model") ?? undefined,
        prompt: fromLink.get("prompt")?.slice(0, 2000),
      };
      setPrefillData({
        prompt: parsed?.prompt,
        model: parsed?.model,
        duration: parsed?.duration,
        aspectRatio: parsed?.aspectRatio,
        quality: parsed?.quality,
        imageUrl: parsed?.imageUrl,
      });
      sessionStorage.removeItem(TOOL_PREFILL_KEY);
    } catch (error) {
      console.warn("Failed to read tool prefill data:", error);
    }
  }, []);

  // 读取一次“使用模板”提示（读取后立即移除，避免重复展示）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(TOOL_PREFILL_NOTICE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setPrefillNotice({
        modelUnavailable: Boolean(parsed?.modelUnavailable),
        originalModel: parsed?.originalModel,
        needsOwnImage: Boolean(parsed?.needsOwnImage),
      });
      sessionStorage.removeItem(TOOL_PREFILL_NOTICE_KEY);
    } catch (error) {
      console.warn("Failed to read tool prefill notice:", error);
    }
  }, []);

  // 加载历史记录（用户登录时）
  useEffect(() => {
    if (!user?.id) return;

    // 从 localStorage 加载历史记录
    const history = videoHistoryStorage.getHistory(user.id);
    setHistoryItems(history);

    // 可选：从服务器同步最近 20 条视频
    fetch(`/api/v1/video/list?limit=20`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.videos) {
          videoHistoryStorage.syncFromServer(data.data.videos);
          setHistoryItems(videoHistoryStorage.getHistory(user.id));
        }
      })
      .catch((error) => {
        console.warn("Failed to sync video history from server:", error);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const localTasks = videoTaskStorage.getGeneratingTasks(user.id);
    localTasks.forEach((task) => {
      addGeneratingId(task.videoId);
      if (!isPolling(task.videoId)) {
        startPolling(task.videoId);
      }
    });
  }, [user?.id, isPolling, startPolling, addGeneratingId]);

  useEffect(() => {
    if (!user?.id) return;
    if (!videoIdFromQuery) return;

    // 立即添加到历史记录（即使是正在生成中）
    const existingItem = videoHistoryStorage.getHistory(user.id).find(item => item.uuid === videoIdFromQuery);
    const existingStatus = existingItem?.status?.toLowerCase();
    const isTerminalStatus = existingStatus === "completed" || existingStatus === "failed";
    if (!existingItem) {
      const newItem: VideoHistoryItem = {
        uuid: videoIdFromQuery,
        userId: user.id,
        prompt: prefillData?.prompt || "",
        model: prefillData?.model || "",
        status: "generating",
        creditsUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      videoHistoryStorage.addHistory(newItem);
      setHistoryItems(videoHistoryStorage.getHistory(user.id));
    }

    setActiveTab("result");
    if (!isTerminalStatus) {
      addGeneratingId(videoIdFromQuery);
      if (!isPolling(videoIdFromQuery)) {
        startPolling(videoIdFromQuery);
      }
    } else {
      removeGeneratingId(videoIdFromQuery);
      stopPolling(videoIdFromQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoIdFromQuery, user?.id]);

  // SSE: listen for backend completion events
  useEffect(() => {
    if (!user?.id) return;
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const source = new EventSource("/api/v1/video/events");

    const handleVideoEvent = async (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const videoId = payload.videoUuid as string;

        if (!videoId) return;
        stopPolling(videoId);

        if (payload.status === "COMPLETED") {
          const res = await fetch(`/api/v1/video/${videoId}`);
          if (!res.ok) return;
          const detail = await res.json();
          handleCompleted(detail.data as Video);
        } else if (payload.status === "FAILED") {
          handleFailed({ videoId, error: payload.error });
        }
      } catch (error) {
        console.warn("SSE event handling failed:", error);
      }
    };

    source.addEventListener("video", handleVideoEvent);

    const handleError = () => {
      source.close();
    };
    source.addEventListener("error", handleError);

    return () => {
      source.removeEventListener("video", handleVideoEvent);
      source.removeEventListener("error", handleError);
      source.close();
    };
  }, [user?.id, handleCompleted, handleFailed, stopPolling]);

  // 处理生成提交
  const handleSubmit = useCallback(async (data: GeneratorData) => {
    // 检查登录
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    // 检查积分
    const requiredCredits = data.estimatedCredits || 0;
    const availableCredits = balance?.availableCredits ?? 0;

    if (availableCredits < requiredCredits) {
      // 打开升级弹窗
      openModal({
        reason: "insufficient_credits",
        requiredCredits,
      });
      return;
    }

    // 乐观更新：立即冻结积分（UI 立即反映变化）
    optimisticFreeze(requiredCredits);

    // 开始提交
    setIsSubmitting(true);

    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        const asked = localStorage.getItem(NOTIFICATION_ASKED_KEY);
        if (!asked && Notification.permission === "default") {
          localStorage.setItem(NOTIFICATION_ASKED_KEY, "1");
          toast.info(tNotify("generationWillNotify"), {
            description: tNotify("notificationDescription"),
            duration: Number.POSITIVE_INFINITY, // 保持显示直到用户操作
            closeButton: true,  // 显示关闭按钮
            action: {
              label: tNotify("enableNotifications"),
              onClick: () => {
                Notification.requestPermission().catch((error) => {
                  console.warn("Notification permission request failed:", error);
                });
              },
            },
          });
        }
      }
    } catch (error) {
      console.warn("Notification permission request failed:", error);
    }

    try {
      const selectedMode = config.generator.mode || toolRoute;
      const imageUrl = data.imageFile
        ? await uploadImage(data.imageFile)
        : data.imageUrl;
      const imageUrls = imageUrl ? [imageUrl] : undefined;
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/v1/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          prompt: data.prompt,
          model: data.model,
          mode: selectedMode,
          duration: data.duration,
          aspectRatio: data.aspectRatio,
          quality: data.quality,
          outputNumber: data.outputNumber ?? 1,
          generateAudio: data.generateAudio,
          imageUrls,
          imageUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || error?.message || "Failed to generate video");
      }

      const result = await response.json();

      if (result.success !== true) {
        if (result.error?.details?.code === "SUBMIT_RESULT_UNKNOWN") {
          toast.warning(
            "We could not confirm your submission yet. Your credits are on hold and will not be charged twice — check My Creations shortly."
          );
          setIsSubmitting(false);
          return;
        }
        throw new Error(result.error?.message || "Failed to generate video");
      }

      const videoUuid = result.data.videoUuid as string;

      toast.success("Generation started");

      // 添加到历史记录
      videoHistoryStorage.addHistory({
        uuid: videoUuid,
        userId: user.id,
        prompt: data.prompt,
        model: data.model,
        status: "generating",
        creditsUsed: data.estimatedCredits,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setHistoryItems(videoHistoryStorage.getHistory(user.id));

      setActiveTab("result");
      addGeneratingId(videoUuid);
      startPolling(videoUuid);

      if (user?.id) {
        videoTaskStorage.addTask({
          userId: user.id,
          videoId: videoUuid,
          taskId: result.data.taskId,
          prompt: data.prompt,
          model: data.model,
          mode: selectedMode,
          status: "generating",
          createdAt: Date.now(),
          notified: false,
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      // API 调用失败，回滚乐观更新（释放积分）
      const requiredCredits = data.estimatedCredits || 0;
      optimisticRelease(requiredCredits);
      // 显示错误提示
      toast.error(error instanceof Error ? error.message : "Failed to generate video");
    }
    setIsSubmitting(false);
  }, [
    user,
    locale,
    router,
    balance,
    config.generator.mode,
    toolRoute,
    startPolling,
    addGeneratingId,
    optimisticFreeze,
    optimisticRelease,
    tNotify,
  ]);

  // 处理重新生成
  const handleRegenerate = useCallback(() => {
    setActiveTab("generator");
  }, []);

  // 处理删除视频
  const handleDelete = useCallback(async (uuid: string) => {
    try {
      const response = await fetch(`/api/v1/video/${uuid}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete video");
      }

      // 从历史记录中删除
      videoHistoryStorage.removeHistory(uuid, user?.id);
      setHistoryItems(videoHistoryStorage.getHistory(user?.id));

      // 更新 currentVideos（兼容旧逻辑）
      setCurrentVideos((prev) => prev.filter((v) => v.uuid !== uuid));
      toast.success("Video deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete video");
    }
  }, [user?.id]);

  // 处理重试失败的视频
  const handleRetry = useCallback(async (uuid: string) => {
    try {
      const response = await fetch(`/api/v1/video/${uuid}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to retry video");
      }
      await response.json();
      resetNotification(uuid);
      resetNotification(`${uuid}:failed`);
      addGeneratingId(uuid);
      startPolling(uuid);
      setCurrentVideos((prev) =>
        prev.map((v) =>
          v.uuid === uuid ? { ...v, status: "GENERATING", errorMessage: null } : v
        )
      );
      toast.success("Video retry started");
    } catch (error) {
      console.error("Retry error:", error);
      toast.error("Failed to retry video");
    }
  }, [addGeneratingId, startPolling, resetNotification]);

  const isChinese = locale.toLowerCase().startsWith("zh");
  const heroCopy = isChinese
    ? {
        "text-to-video": {
          title: "文字输入，画面动起来",
          description: "描述一个场景即可生成电影感短片。选择模型、时长和比例，然后开始生成。",
        },
        "image-to-video": {
          title: "让静态画面动起来",
          description: "上传一张图片并描述希望的运动方式，提示词会引导镜头与主体动作。",
        },
        "reference-to-video": {
          title: "保持一致的视觉风格",
          description: "使用参考图片，让角色与产品在不同视频片段中保持一致。",
        },
      }
    : {
        "text-to-video": {
          title: "Words in, motion out",
          description: "Describe a scene and get a short cinematic clip. Pick a model, set the length and ratio, then generate.",
        },
        "image-to-video": {
          title: "Bring a still to life",
          description: "Upload one image and describe the movement you want. Camera moves and subject motion are guided by your prompt.",
        },
        "reference-to-video": {
          title: "Keep your look consistent",
          description: "Use reference images to keep characters and products consistent across every clip you make.",
        },
      };

  const mode = (
    toolRoute in heroCopy ? toolRoute : "text-to-video"
  ) as keyof typeof heroCopy;

  void activeTab;
  void setActiveTab;
  void tTool;

  const showPrefillNotice =
    Boolean(prefillNotice) &&
    !noticeDismissed &&
    Boolean(prefillNotice?.modelUnavailable || prefillNotice?.needsOwnImage);

  const prefillNoticeNode = showPrefillNotice ? (
    <div className="mb-3 flex items-start gap-2 rounded-[12px] border border-[var(--du-border-strong)] bg-[var(--du-accent-soft)] px-3 py-2">
      <div className="flex-1">
        {prefillNotice?.modelUnavailable ? (
          <p className="text-[12px] leading-relaxed text-[var(--du-text)]">
            {tGallery("notices.modelUnavailable", {
              model: prefillNotice.originalModel ?? "",
            })}
          </p>
        ) : null}
        {prefillNotice?.needsOwnImage ? (
          <p className="text-[12px] leading-relaxed text-[var(--du-text)]">
            {tGallery("notices.needsOwnImage")}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setNoticeDismissed(true)}
        className="shrink-0 text-[12px] font-medium text-[var(--du-accent-text)] transition-colors hover:text-[var(--du-text)]"
      >
        {tGallery("publishDialog.close")}
      </button>
    </div>
  ) : null;

  const generatorNode = (
    <>
      {prefillNoticeNode}
      <GeneratorPanel
        key={prefillData ? "studio-draft" : "blank-studio"}
        toolType={
          toolRoute as
            | "image-to-video"
            | "text-to-video"
            | "reference-to-video"
        }
        isLoading={isSubmitting}
        onSubmit={handleSubmit}
        availableModelIds={config.generator.models.available}
        defaultModelId={config.generator.models.default}
        initialPrompt={prefillData?.prompt}
        initialModelId={prefillData?.model}
        initialDuration={prefillData?.duration}
        initialAspectRatio={prefillData?.aspectRatio}
        initialQuality={prefillData?.quality}
        initialImageUrl={prefillData?.imageUrl}
      />
    </>
  );

  // Unauthenticated Layout: Scrollable, Tool Area + Landing Page
  if (!user) {
    return (
      <>
        <div className="flex flex-1 min-w-0 flex-col lg:overflow-y-auto">
          <HfWorkbenchShell
            generator={generatorNode}
            history={
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="font-display text-[16px] font-bold uppercase tracking-[-0.04em] text-[var(--du-text)]">
                  {isChinese ? "你的历史记录会显示在这里" : "Your history lives here"}
                </h3>
                <p className="mt-2 max-w-[320px] text-[14px] text-[var(--du-text-muted)]">
                  {isChinese
                    ? "登录后即可生成视频，并在这里集中查看所有结果。"
                    : "Sign in to generate videos and keep every result in one place."}
                </p>
              </div>
            }
            heroTitle={heroCopy[mode].title}
            heroDescription={heroCopy[mode].description}
            activeMode={mode}
            lang={locale}
          />
          <ToolLandingPage config={config} locale={locale} />
        </div>

        {/* 全局升级弹窗 */}
        <UpgradeModal />
      </>
    );
  }

  // Authenticated Layout: Three-column application mode
  return (
    <>
      <div className="flex flex-1 min-w-0 flex-col">
        <HfWorkbenchShell
          generator={generatorNode}
          history={
            <VideoHistoryPanel
              historyItems={historyItems}
              generatingIds={generatingIds}
              onDelete={handleDelete}
              className="h-full min-h-0"
            />
          }
          heroTitle={heroCopy[mode].title}
          heroDescription={heroCopy[mode].description}
          activeMode={mode}
          lang={locale}
        />
      </div>

      {/* 全局升级弹窗 */}
      <UpgradeModal />
    </>
  );
}

export default ToolPageLayout;
