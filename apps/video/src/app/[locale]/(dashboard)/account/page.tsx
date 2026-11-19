import { eq } from "drizzle-orm";
import Link from "next/link";

import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { UserAvatar } from "@/components/user-avatar";
import { CopyPromptButton } from "@/components/hf/studio-results";
import { ManageSubscriptionButton } from "@/components/account/manage-subscription-button";
import { customers, db } from "@/db";
import { copyFor, planLabel } from "@/lib/account-view";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import { creditService } from "@/services/credit";

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: locale === "zh" ? "账户" : "Account" };
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const copy = copyFor(locale);
  const balance = await creditService.getBalance(user.id);

  const [customer] = await db
    .select({ stripeCurrentPeriodEnd: customers.stripeCurrentPeriodEnd })
    .from(customers)
    .where(eq(customers.authUserId, user.id))
    .limit(1);

  const periodEnd = toDate(customer?.stripeCurrentPeriodEnd ?? null);
  const renewsOn = periodEnd
    ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
      }).format(periodEnd)
    : null;

  const paymentsEnabled = isPaymentsConfigured();

  const zh = locale.toLowerCase().startsWith("zh");
  const joined = toDate(user.createdAt ?? null);
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(date);

  return (
    <div className="db-page">
      <header className="db-head">
        <div>
          <h1 className="db-title">{copy.title}</h1>
          <p className="db-sub">{zh ? "个人资料、套餐和偏好设置" : "Profile, plan and preferences"}</p>
        </div>
      </header>

      <section className="db-card">
        <div className="db-profile">
          <UserAvatar user={{ name: user.name ?? null, image: user.image ?? null }} className="h-16 w-16 text-xl" />
          <div>
            <p className="db-profile-name">{user.name || user.email}</p>
            <p className="db-sub">{user.email}</p>
          </div>
        </div>
        <dl className="db-fields" style={{ marginTop: "var(--ds-space-5)" }}>
          <div>
            <dt>{zh ? "邮箱" : "Email"}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{zh ? "加入时间" : "Joined"}</dt>
            <dd>{joined ? formatDate(joined) : "—"}</dd>
          </div>
          <div>
            <dt>{zh ? "用户 ID" : "User ID"}</dt>
            <dd className="db-mono db-copyable">
              {user.id}
              <CopyPromptButton prompt={user.id} zh={zh} className="db-copy" label={zh ? "复制用户 ID" : "Copy user ID"} />
            </dd>
          </div>
        </dl>
      </section>

      <div className="db-two">
        <section className="db-card">
          <p className="db-stat-label">{copy.planHeading}</p>
          <p className="db-plan-name">{planLabel(balance.plan, copy)}</p>
          {renewsOn ? (
            <p className="db-sub">
              {copy.renewsOn} {renewsOn}
            </p>
          ) : (
            <p className="db-sub">{zh ? "升级后每月积分更多，单价更低。" : "Upgrade for more credits each month at a lower price."}</p>
          )}
          <div className="db-actions">
            <Link className="db-btn db-btn-accent" href={`/${locale}/pricing`}>
              {zh ? "查看套餐" : "See plans"}
            </Link>
            {/* Only subscribers have something to manage. */}
            {balance.plan === "PRO" || balance.plan === "BUSINESS" ? <ManageSubscriptionButton enabled={paymentsEnabled} copy={copy} /> : null}
          </div>
        </section>

        <section className="db-card">
          <p className="db-stat-label">{zh ? "可用积分" : "Available credits"}</p>
          <p className="db-plan-name">{balance.availableCredits.toLocaleString(zh ? "zh-CN" : "en-US")}</p>
          <p className="db-sub">
            {balance.expiringSoon > 0
              ? zh
                ? `其中 ${balance.expiringSoon} 积分将在 7 天内过期`
                : `${balance.expiringSoon} of these expire within 7 days`
              : zh
                ? "生成失败的积分会自动退回"
                : "Credits from failed runs come back automatically"}
          </p>
          <div className="db-actions">
            <Link className="db-btn" href={`/${locale}/credits`}>
              {zh ? "积分明细" : "Credit history"}
            </Link>
            <Link className="db-btn" href={`/${locale}/pricing`}>
              {copy.buyCredits}
            </Link>
          </div>
        </section>
      </div>

      <section className="db-card">
        <h2 className="db-h2" style={{ marginBottom: "var(--ds-space-2)" }}>{zh ? "偏好" : "Preferences"}</h2>
        <div className="db-pref">
          <span className="db-pref-label">
            {zh ? "界面语言" : "Language"}
            <span>{zh ? "网站文字和生成器提示使用的语言" : "Used for the site and the studio"}</span>
          </span>
          <span className="db-seg">
            <Link href="/zh/account" aria-current={zh ? "true" : undefined}>
              简体中文
            </Link>
            <Link href="/account" aria-current={zh ? undefined : "true"}>
              English
            </Link>
          </span>
        </div>
        <div className="db-pref">
          <span className="db-pref-label">
            {zh ? "退出登录" : "Sign out"}
            <span>{zh ? "在这台设备上退出当前账户" : "Sign out of this account on this device"}</span>
          </span>
          <SignOutButton lang={locale} label={zh ? "退出登录" : "Sign out"} />
        </div>
      </section>
    </div>
  );
}