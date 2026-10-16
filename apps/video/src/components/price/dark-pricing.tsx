"use client";

import { useMemo, useState, useTransition } from "react";
import Balancer from "react-wrap-balancer";
import { IconCheck, IconX } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { creem } from "@/lib/auth/client";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  paymentsEnabled?: boolean;
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
  paymentsEnabled = false,
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
    if (!paymentsEnabled) return;
    if (!userId) {
      signInModal.onOpen();
      return;
    }

    startTransition(async () => {
      const result = await startStripeCheckout(product.id);

      if (!result.ok) {
        toast.error("Checkout error", { description: result.error });
      }
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
        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--du-glass-border)] bg-[var(--du-surface-2)] p-1">
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
              <span className="ml-1.5 rounded bg-[var(--du-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--du-on-accent)]">
                {t("save_percent", { percent: yearlySavePct })}
              </span>
            )}
          </TabButton>
        </div>
        <p className="text-xs text-[var(--du-text-muted)]">{t("billing_note")}</p>
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
                paymentsEnabled={paymentsEnabled}
              />
            );
          })}
          {activeTab !== "onetime" && (
            <div className="relative flex flex-col rounded-2xl border border-[var(--du-glass-border)] bg-[var(--du-surface)] p-4">
              <p className="text-2xl font-black uppercase tracking-tight">
                {t("business_title")}
              </p>
              <p className="mt-1 text-sm text-[var(--du-text-muted)]">{t("business_desc")}</p>
              <div className="mt-4 rounded-xl border border-[var(--du-glass-border)] bg-[var(--du-glass-bg)] p-3">
                <p className="text-sm text-[var(--du-text-muted)]">{t("business_note")}</p>
              </div>
              <div
                aria-disabled="true"
                className="mt-4 flex h-11 w-full cursor-not-allowed select-none items-center justify-center rounded-xl bg-[var(--du-glass-bg-strong)] text-sm font-semibold text-[var(--du-text-muted)]"
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
          ? "bg-[var(--du-surface-2)] text-[var(--du-text)]"
          : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"
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
  paymentsEnabled?: boolean;
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
  paymentsEnabled = false,
}: PricingCardProps) {
  const t = useTranslations("PricingCards");

  const cardButtonClass = cn(
    "mt-4 h-11 w-full rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
    isRecommended
      ? "bg-[var(--du-accent)] text-[var(--du-on-accent)] hover:bg-[var(--du-accent)]/90"
      : "bg-[var(--du-text)] text-[var(--du-bg)] hover:bg-[var(--du-text)]/90"
  );

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-4",
        isRecommended
          ? "border-[var(--du-accent)]/40 bg-gradient-to-b from-[var(--du-accent)]/[0.12] via-[var(--du-surface)] to-[var(--du-surface)]"
          : "border-[var(--du-glass-border)] bg-[var(--du-surface)]"
      )}
    >
      <div className="flex items-center">
        <p className="text-2xl font-black uppercase tracking-tight">
          {product.displayName}
        </p>
        {isRecommended && (
          <span className="ml-2 rounded bg-[var(--du-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--du-on-accent)]">
            {t("popular")}
          </span>
        )}
      </div>

      {product.displayDescription ? (
        <p className="mt-1 text-sm text-[var(--du-text-muted)]">
          {product.displayDescription}
        </p>
      ) : null}

      {/* 显示积分数 */}
      {product.credits && (
        <div className="mt-4 rounded-xl border border-[var(--du-glass-border)] bg-[var(--du-glass-bg)] p-3">
          <p className="text-sm font-semibold">
            {product.credits.toLocaleString()} {dictCredits.title || "Credits"}
          </p>
          {product.billingPeriod === "year" && (
            <p className="mt-0.5 text-xs text-[var(--du-text-muted)]">
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
        <span className="text-sm font-medium text-[var(--du-text-muted)]">
          {product.billingPeriod ? (product.billingPeriod === "year" ? t("per_year") : t("per_month")) : ""}
        </span>
      </div>

      {product.billingPeriod === "year" && (
        <p className="mt-1 text-xs text-[var(--du-text-muted)]">
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
                    disabled={isPending || isRestricted || !paymentsEnabled}
                    onClick={() => onCheckout(product)}
                    className={cn(cardButtonClass, "mt-0")}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : !paymentsEnabled ? (
                      t("coming_soon")
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
      ) : !paymentsEnabled ? (
        <button
          type="button"
          disabled
          className={cardButtonClass}
        >
          {t("coming_soon")}
        </button>
      ) : (
        <button
          type="button"
          onClick={signInModal.onOpen}
          className={cardButtonClass}
        >
          {dictPrice.signup}
        </button>
      )}

      <div className="mt-4 rounded-xl border border-[var(--du-glass-border)] bg-[var(--du-glass-bg)] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--du-text-muted)]">
          {t("features")}
        </p>
        <ul>
          {features.map((feature, idx) => (
            <li className="flex items-start gap-2 py-1 text-sm" key={idx}>
              {feature.included ? (
                <IconCheck className="h-4 w-4 shrink-0 text-[var(--du-accent)]" />
              ) : (
                <IconX className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]/60" />
              )}
              <p className={cn(feature.included ? "text-[var(--du-text)]" : "text-[var(--du-text-muted)]")}>
                {feature.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
