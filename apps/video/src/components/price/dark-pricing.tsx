"use client";

import { useMemo, useState, useTransition } from "react";
import Balancer from "react-wrap-balancer";
import { IconCheck, IconX } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { creem } from "@/lib/auth/client";
import { readAttributionCookie } from "@/lib/attribution";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

import { useSigninModal } from "@/hooks/use-signin-modal";
import {
  getLocalizedOnetimePackages,
  getLocalizedSubscriptionPackages,
  type CreditsDictionary,
  type LocalizedPackage,
} from "@/hooks/use-credit-packages";
import { useCredits } from "@/stores/credits-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DarkPricingProps {
  userId?: string;
  dictPrice: Record<string, string>;
  dictCredits: CreditsDictionary;
}

type PricingTab = "onetime" | "monthly" | "yearly";
type FeatureItem = {
  text: string;
  included: boolean;
};

function formatPrice(cents: number): string {
  const value = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return `$${value}`;
}

// 定义标准功能列表（所有产品功能的并集）
function getStandardFeatures(products: LocalizedPackage[]): FeatureItem[] {
  // 收集所有产品的功能
  const allFeatures = products.flatMap(p => p.localizedFeatures);
  // 去重
  const uniqueFeatures = Array.from(new Set(allFeatures));

  return uniqueFeatures.map(feature => ({
    text: feature,
    included: false, // 默认为 false，每个产品会自己设置
  }));
}

export function DarkPricing({
  userId,
  dictPrice,
  dictCredits,
}: DarkPricingProps) {
  const t = useTranslations("PricingCards");
  const [activeTab, setActiveTab] = useState<PricingTab>("monthly");
  const [hasAccess, setHasAccess] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const signInModal = useSigninModal();
  const { balance } = useCredits();
  const userPlan = balance?.plan || "FREE";
  const isFreeUser = !userPlan || userPlan === "FREE";

  // 组织产品数据
  const allSubscriptionProducts = useMemo(
    () =>
      getLocalizedSubscriptionPackages(dictCredits).sort(
        (a, b) => a.credits - b.credits
      ),
    [dictCredits]
  );

  const onetimeProducts = useMemo(
    () =>
      getLocalizedOnetimePackages(dictCredits).sort(
        (a, b) => a.credits - b.credits
      ),
    [dictCredits]
  );

  const monthlyProducts = useMemo(
    () => allSubscriptionProducts.filter((p) => p.billingPeriod === "month"),
    [allSubscriptionProducts]
  );

  const yearlyProducts = useMemo(
    () => allSubscriptionProducts.filter((p) => p.billingPeriod === "year"),
    [allSubscriptionProducts]
  );

  // 计算年付相对月付的最大节省比例（仅基于产品数据，不硬编码）
  const yearlySavePct = useMemo(() => {
    const pairs = Math.min(monthlyProducts.length, yearlyProducts.length);
    let maxPct = 0;

    for (let i = 0; i < pairs; i++) {
      const monthlyAmount = monthlyProducts[i].price.amount * 12;
      const yearlyAmount = yearlyProducts[i].price.amount;
      if (monthlyAmount <= 0) continue;

      const pct = Math.round((1 - yearlyAmount / monthlyAmount) * 100);
      if (pct > maxPct) maxPct = pct;
    }

    return maxPct > 0 ? maxPct : 0;
  }, [monthlyProducts, yearlyProducts]);

  const handleCheckout = (product: LocalizedPackage) => {
    if (!PAYMENTS_ENABLED) return;
    if (!userId) {
      signInModal.onOpen();
      return;
    }

    startTransition(async () => {
      const origin = window.location.origin;
      // 支付成功后跳转到 credits 页面
      // 如果当前不在 pricing 页面（例如嵌入在其他页面的弹窗），则设置 returnTo 以便跳回
      // 如果本来就在 pricing 页面，则不设置 returnTo，让用户停留在 credits 页面查看余额
      const currentPath = window.location.pathname;
      const isPricingPage = currentPath.includes("/pricing");
      const returnTo = isPricingPage ? "" : encodeURIComponent(currentPath);

      const successUrl = returnTo
        ? `${origin}/credits?payment=success&returnTo=${returnTo}`
        : `${origin}/credits?payment=success`;

      const { data, error } = await creem.createCheckout({
        productId: product.id,
        successUrl,
        metadata: {
          plan: product.id,
          attribution: readAttributionCookie() ?? undefined,
        },
      });

      if (error) {
        toast.error("Checkout error", {
          description: error.message ?? "Failed to create checkout session.",
        });
        return;
      }

      if (!data || !("url" in data) || !data.url) {
        toast.error("Checkout error", {
          description: "Missing checkout URL from Creem.",
        });
        return;
      }

      window.location.href = data.url;
    });
  };

  const handlePortal = async () => {
    const { data, error } = await creem.createPortal();
    if (error) {
      toast.error("Portal error", {
        description: error.message ?? "Failed to open customer portal.",
      });
      return;
    }

    if (!data || !("url" in data) || !data.url) {
      toast.error("Portal error", {
        description: "Missing portal URL from Creem.",
      });
      return;
    }

    window.location.href = data.url;
  };

  // 获取当前 tab 的产品
  const getCurrentProducts = () => {
    switch (activeTab) {
      case "onetime":
        return onetimeProducts;
      case "monthly":
        return monthlyProducts;
      case "yearly":
        return yearlyProducts;
      default:
        return [];
    }
  };

  const currentProducts = getCurrentProducts();
  const buyCreditsLabel = dictCredits.buy_credits ?? "Buy Credits";

  // 计算标准功能列表（所有产品的功能并集）
  const standardFeatures = useMemo(() => {
    return getStandardFeatures(currentProducts);
  }, [currentProducts]);

  return (
    <section className="flex w-full flex-col text-left">
      {/* Tab 切换 */}
      <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.06] bg-[#1c1d20] p-1">
          <TabButton
            active={activeTab === "onetime"}
            onClick={() => setActiveTab("onetime")}
          >
            {t("onetime")}
          </TabButton>
          <TabButton
            active={activeTab === "monthly"}
            onClick={() => setActiveTab("monthly")}
          >
            {t("monthly")}
          </TabButton>
          <TabButton
            active={activeTab === "yearly"}
            onClick={() => setActiveTab("yearly")}
          >
            {t("yearly")}
            {yearlySavePct > 0 && (
              <span className="ml-1.5 rounded bg-[#d1fe17] px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">
                {t("save_percent", { percent: yearlySavePct })}
              </span>
            )}
          </TabButton>
        </div>
        <p className="text-xs text-[#9a9ba0]">{t("billing_note")}</p>
      </div>

      {/* 价格卡片 */}
      {currentProducts.length > 0 ? (
        <div
          className={cn(
            "grid w-full gap-3",
            activeTab === "onetime"
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : "sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
          {currentProducts.map((product, index) => {
            const isRecommended = product.popular === true;
            const isCurrent = activeProductId === product.id && hasAccess;

            // 为每个产品生成对齐后的功能列表
            const alignedFeatures = standardFeatures.map(feature => ({
              ...feature,
              included: product.localizedFeatures.some(f => f === feature.text),
            }));

            // 检查是否允许免费用户购买
            const isRestricted = isFreeUser && product.allowFreeUser === false;

            return (
              <PricingCard
                key={product.id}
                product={product}
                features={alignedFeatures}
                isRecommended={isRecommended}
                isCurrent={isCurrent}
                userId={userId}
                isPending={isPending}
                isRestricted={isRestricted} // Pass restriction status
                buyCreditsLabel={buyCreditsLabel}
                dictPrice={dictPrice}
                dictCredits={dictCredits}
                onCheckout={handleCheckout}
                onPortal={handlePortal}
                signInModal={signInModal}
              />
            );
          })}
          {activeTab !== "onetime" && (
            <div className="relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#16181b] p-4">
              <p className="text-2xl font-black uppercase tracking-tight">
                {t("business_title")}
              </p>
              <p className="mt-1 text-sm text-[#9a9ba0]">{t("business_desc")}</p>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
                <p className="text-sm text-[#9a9ba0]">{t("business_note")}</p>
              </div>
              <div
                aria-disabled="true"
                className="mt-4 flex h-11 w-full cursor-not-allowed select-none items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold text-[#9a9ba0]"
              >
                {t("coming_soon")}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          {t("no_products")}
        </div>
      )}
    </section>
  );
}

// ============================================
// Tab Button Component
// ============================================

interface TabButtonProps {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

function TabButton({ active, children, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-9 rounded-lg px-4 text-sm font-medium transition-colors",
        active
          ? "bg-[#26272b] text-[#f7f7f8]"
          : "text-[#9a9ba0] hover:text-[#f7f7f8]"
      )}
    >
      {children}
    </button>
  );
}

// ============================================
// Pricing Card Component
// ============================================

interface PricingCardProps {
  product: LocalizedPackage;
  features: FeatureItem[];
  isRecommended: boolean;
  isCurrent: boolean;
  userId?: string;
  isPending: boolean;
  buyCreditsLabel: string;
  dictPrice: Record<string, string>;
  dictCredits: CreditsDictionary;
  onCheckout: (product: LocalizedPackage) => void;
  onPortal: () => void;
  signInModal: { onOpen: () => void };
  isRestricted?: boolean;
}

function PricingCard({
  product,
  features,
  isRecommended,
  isCurrent,
  userId,
  isPending,
  buyCreditsLabel,
  dictPrice,
  dictCredits,
  onCheckout,
  onPortal,
  signInModal,
  isRestricted = false,
}: PricingCardProps) {
  const t = useTranslations("PricingCards");

  const cardButtonClass = cn(
    "mt-4 h-11 w-full rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
    isRecommended
      ? "bg-[#d1fe17] text-black hover:bg-[#d1fe17]/90"
      : "bg-white text-black hover:bg-white/90"
  );

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-4",
        isRecommended
          ? "border-[#d1fe17]/40 bg-gradient-to-b from-[#d1fe17]/[0.12] via-[#16181b] to-[#16181b]"
          : "border-white/[0.06] bg-[#16181b]"
      )}
    >
      <div className="flex items-center">
        <p className="text-2xl font-black uppercase tracking-tight">
          {product.displayName}
        </p>
        {isRecommended && (
          <span className="ml-2 rounded bg-[#d1fe17] px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">
            {t("popular")}
          </span>
        )}
      </div>

      {product.displayDescription ? (
        <p className="mt-1 text-sm text-[#9a9ba0]">
          {product.displayDescription}
        </p>
      ) : null}

      {/* 显示积分数 */}
      {product.credits && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="text-sm font-semibold">
            {product.credits.toLocaleString()} {dictCredits.title || "Credits"}
          </p>
          {product.billingPeriod === "year" && (
            <p className="mt-0.5 text-xs text-[#9a9ba0]">
              {t("credits_per_month", {
                credits: Math.round(product.credits / 12).toLocaleString(),
              })}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-end gap-1.5">
        <span className="text-4xl font-bold leading-none">
          {formatPrice(product.price.amount)}
        </span>
        <span className="text-sm font-medium text-[#9a9ba0]">
          {product.billingPeriod ? (product.billingPeriod === "year" ? t("per_year") : t("per_month")) : ""}
        </span>
      </div>

      {product.billingPeriod === "year" && (
        <p className="mt-1 text-xs text-[#9a9ba0]">
          {t("price_per_month", {
            price: formatPrice(Math.round(product.price.amount / 12)),
          })}
        </p>
      )}

      {userId ? (
        isCurrent ? (
          <button
            type="button"
            onClick={onPortal}
            className={cardButtonClass}
          >
            {dictPrice.manage_subscription}
          </button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-4 block w-full">
                  <button
                    type="button"
                    disabled={isPending || isRestricted || !PAYMENTS_ENABLED}
                    onClick={() => onCheckout(product)}
                    className={cn(cardButtonClass, "mt-0")}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : !PAYMENTS_ENABLED ? (
                      "Payments coming soon"
                    ) : isRestricted ? (
                      "Subscribers Only"
                    ) : product.billingPeriod ? (
                      dictPrice.upgrade
                    ) : (
                      buyCreditsLabel
                    )}
                  </button>
                </span>
              </TooltipTrigger>
              {isRestricted && (
                <TooltipContent>
                  <p>This pack is only available to active subscribers.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      ) : (
        <button
          type="button"
          onClick={signInModal.onOpen}
          className={cardButtonClass}
        >
          {dictPrice.signup}
        </button>
      )}

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9a9ba0]">
          {t("features")}
        </p>
        <ul>
          {features.map((feature, idx) => (
            <li className="flex items-start gap-2 py-1 text-sm" key={idx}>
              {feature.included ? (
                <IconCheck className="h-4 w-4 shrink-0 text-[#d1fe17]" />
              ) : (
                <IconX className="h-4 w-4 shrink-0 text-[#9a9ba0]/60" />
              )}
              <p className={cn(feature.included ? "text-[#f7f7f8]" : "text-[#9a9ba0]")}>
                {feature.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
