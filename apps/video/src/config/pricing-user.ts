import { LEGAL_CONFIG } from "@/config/legal";

/**
 * ============================================
 * 用户配置文件 - 价格和积分
 * ============================================
 *
 * 📖 使用指南
 * -----------
 * 这个文件包含了所有与价格、积分相关的配置。
 *
 * 🎯 主要配置项：
 * 1. 基础设置 - 新用户赠送、过期规则
 * 2. 订阅产品 - 月付/年付订阅价格和积分
 * 3. 积分包 - 一次性购买积分包
 * 4. 模型计费 - 各 AI 模型的积分消耗规则
 *
 * 📝 修改方法：
 * - 直接修改下面的数值即可（价格用美元，不是美分）
 * - 保存后自动生效，无需重启服务器
 * - 要禁用某个产品，将 enabled 改为 false
 *
 * ⚠️ 注意事项：
 * - id 字段：必须填入 Creem 后台的 Product ID（格式：prod_xxx）
 * - 价格使用美元单位（如 9.9 表示 $9.90）
 * - 积分数量是整数
 * - allowFreeUser: 是否允许免费用户购买（可选，默认 true）
 *
 * 🔄 Creem 配置流程：
 * 1. 在 Creem 后台创建产品（订阅和积分包）
 * 2. 复制每个产品的 Product ID（如 prod_4yNyvLWQ88n8AqJj35uOvK）
 * 3. 将 Product ID 填入下方对应产品的 id 字段
 * 4. .env.local 中无需配置 Price ID（已弃用）
 *
 * ============================================
 */

// ============================================
// 类型定义（内部使用）
// ============================================

/** 视频模型积分配置 */
export interface VideoModelPricing {
  baseCredits: number;
  perSecond: number;
  qualityMultiplier?: number;
  enabled: boolean;
}

/** 订阅产品配置 */
export interface SubscriptionProductConfig {
  id: string;
  name: string;
  priceUsd: number;
  credits: number;
  period: "month" | "year";
  popular?: boolean;
  enabled: boolean;
  features?: string[];
}

/** 积分包配置 */
export interface CreditPackageConfig {
  id: string;
  name: string;
  priceUsd: number;
  credits: number;
  popular?: boolean;
  enabled: boolean;
  /** 是否允许免费用户购买（可选，默认 true） */
  allowFreeUser?: boolean;
  features?: string[];
}

// ============================================
// 一、基础设置
// ============================================

/**
 * 新用户注册赠送积分
 */
export const NEW_USER_GIFT = {
  /** 是否启用赠送 */
  enabled: true,
  /** 赠送积分数量 */
  credits: 75, // 够生成一条 Veo 3.1 Fast（75 积分），或十几张图片
  /** 积分有效期（天）*/
  validDays: 7,
};

/**
 * 积分过期设置
 */
export const CREDIT_EXPIRATION = {
  /** 订阅积分有效期（天）- 月付用户 */
  subscriptionDays: 30,
  /** 一次性购买积分有效期（天）- 单独购买积分包 */
  purchaseDays: 365,
  /** 提前多少天提醒积分即将过期 */
  warnBeforeDays: 7,
};

// ============================================
// 二、订阅产品配置
// ============================================

/**
 * 订阅产品列表
 *
 * 每个产品包含：
 * - id: Creem Product ID（从 Creem 后台复制，如 prod_xxx）
 * - name: 显示名称
 * - priceUsd: 价格（美元）
 * - credits: 每周期赠送积分
 * - period: 付费周期 ("month" 或 "year")
 * - popular: 是否标记为推荐（最多选1-2个）
 * - enabled: 是否启用该产品
 *
 * ⚠️ 重要：id 字段必须是 Creem 后台的 Product ID（格式：prod_xxx）
 * 在 Creem 后台创建产品后，复制 Product ID 到下方对应的 id 字段
 */
export const SUBSCRIPTION_PRODUCTS = [
  // ===== 月付订阅 =====
  {
    id: "prod_jsRIeZmqn3L9NN2fiFIn6", // 从 Creem 后台复制 Basic Monthly Product ID
    name: "Basic Plan",
    priceUsd: 9.9,
    credits: 1000,
    period: "month" as const,
    popular: false,
    enabled: true,
    features: ["hd_videos", "fast_generation"],
  },
  {
    id: "prod_3tlZPSRNHZSaNq21zX2Z16", // 从 Creem 后台复制 Pro Monthly Product ID
    name: "Pro Plan",
    priceUsd: 29.9,
    credits: 3300,
    period: "month" as const,
    popular: true, // 推荐
    enabled: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },
  {
    id: "prod_3tlZPSRNHZSaNq22zX2Z18", // 从 Creem 后台复制 Ultimate Monthly Product ID
    name: "Ultimate Plan",
    priceUsd: 79.9,
    credits: 9600,
    period: "month" as const,
    popular: false,
    enabled: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },

  // ===== 年付订阅（全线统一 7 折 / 立省 30%；积分一次发全年） =====
  {
    id: "prod_3tlZPSRNHZSaNq22zX2Z10", // 从 Creem 后台复制 Basic Yearly Product ID
    name: "Basic Plan (Yearly)",
    priceUsd: 82.9, // 月付 × 12 × 0.7（折合 US$6.9/月，立省 30%）
    credits: 12000, // 1000 × 12
    period: "year" as const,
    popular: false,
    enabled: true,
    features: ["hd_videos", "fast_generation"],
  },
  {
    id: "prod_3tlZPSRNHZSaNq22zX2Z55", // 从 Creem 后台复制 Pro Yearly Product ID
    name: "Pro Plan (Yearly)",
    priceUsd: 250.9, // 月付 × 12 × 0.7（折合 US$20.9/月，立省 30%）
    credits: 39600, // 3300 × 12
    period: "year" as const,
    popular: true,
    enabled: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },
  {
    id: "prod_3tlZPSRNHZSaNq22zX2Z21", // 从 Creem 后台复制 Ultimate Yearly Product ID
    name: "Ultimate Plan (Yearly)",
    priceUsd: 670.9, // 月付 × 12 × 0.7（折合 US$55.9/月，立省 30%）
    credits: 115200, // 9600 × 12
    period: "year" as const,
    popular: false,
    enabled: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },
];

// ============================================
// 三、一次性购买积分包
// ============================================

/**
 * 积分包产品列表
 *
 * 用户可以单独购买积分包（不订阅）
 *
 * allowFreeUser 说明：
 * - true:  所有用户都可以购买此积分包
 * - false: 只有订阅用户才能购买此积分包
 * - 不填: 默认为 true（所有用户可购买）
 *
 * ⚠️ 重要：id 字段必须是 Creem 后台的 Product ID（格式：prod_xxx）
 */
export const CREDIT_PACKAGES: CreditPackageConfig[] = [
  {
    id: "prod_aivd_pack_trial", // 本地商品编号；Stripe 按下单时的金额收款，不需要在后台建商品
    name: "Trial Pack",
    priceUsd: 4.9,
    credits: 330, // 够生成 1 条 Seedance 2.5（325）或 4 条 Veo 3.1 Fast（75×4）
    popular: false,
    enabled: true,
    allowFreeUser: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },
  {
    id: "prod_3tlZPSRNHZSaNq21zX2ZPO",
    name: "Starter Pack",
    priceUsd: 9.9,
    credits: 700,
    popular: true, // 推荐
    enabled: true,
    allowFreeUser: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },
  {
    id: "prod_3tlZPSRNHZSaNq22zX2Z12",
    name: "Standard Pack",
    priceUsd: 29.9,
    credits: 2200,
    popular: false,
    enabled: true,
    allowFreeUser: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },
  {
    id: "prod_3tlZPSRNHZSaNq22zX2Z13",
    name: "Pro Pack",
    priceUsd: 99.9,
    credits: 8000,
    popular: false,
    enabled: true,
    allowFreeUser: true,
    features: ["hd_videos", "fast_generation", "commercial_use"],
  },
];

// ============================================
// 三之二、档位权益与促销
// ============================================

export type PlanTier = "free" | "basic" | "pro" | "ultimate";

/** Which tier a subscription product belongs to, from its name. */
export function planTierOfName(name: string): Exclude<PlanTier, "free"> {
  const lower = name.toLowerCase();
  return lower.startsWith("pro") ? "pro" : lower.startsWith("ultimate") ? "ultimate" : "basic";
}

/**
 * 各档权益：同时进行的生成任务数、是否优先排队。
 * free 是没有有效订阅的账号（包括只买过积分包的）。
 *
 * priorityQueue 目前全部是 false：站内还没有优先排队的实现，页面只在它为 true
 * 时才写"优先排队"。做出来之后再把 pro、ultimate 改成 true。
 */
export const PLAN_PERKS: Record<PlanTier, { concurrency: number; priorityQueue: boolean }> = {
  free: { concurrency: 1, priorityQueue: false },
  basic: { concurrency: 1, priorityQueue: false },
  pro: { concurrency: 3, priorityQueue: false },
  ultimate: { concurrency: 6, priorityQueue: false },
};

/**
 * 开业活动：活动期内，账号的第一笔付款多送一部分积分。
 * endsAt 为 null 时活动关闭；填一个真实的结束时间（ISO，UTC）后生效，到点自动结束。
 * 这个日期会原样显示在定价页上，不要填一个不会真正结束的日期。
 */
export const LAUNCH_OFFER: { bonusPercent: number; endsAt: string | null } = {
  bonusPercent: 30,
  endsAt: null,
};

/** Whether the launch offer is running at `now`. */
export function isLaunchOfferActive(now: Date = new Date()): boolean {
  return LAUNCH_OFFER.endsAt !== null && now.getTime() < new Date(LAUNCH_OFFER.endsAt).getTime();
}

/**
 * 首月优惠：从未付过款的账号第一次订阅 Pro 月付时，第一个月打折，之后按原价续费。
 * 页面上会同时写出首月价和续费价。
 */
export const FIRST_MONTH_OFFER = {
  enabled: true,
  tier: "pro" as const,
  /**
   * 首月实付（美元）。结账时按"原价减去这个数"生成一次性折扣。
   * 配合 VIDEO_MARKUP=1.95 与年付 7 折（US$20.9/月）保持一致：
   * 首月 US$20.9（立省 30%），即使极端满载最贵模型仍保持 ~14% 正毛利。
   */
  priceUsd: 20.9,
  /** 页面上说的折扣力度，约数。 */
  percentOff: 30,
};

/** 退款规则：首次购买后这么多天内、积分未使用，可全额退款。天数与退款政策页同源。 */
export const REFUND_POLICY = { days: LEGAL_CONFIG.refundWindowDays };

// ============================================
// 四、AI 模型积分计费
// ============================================

/**
 * 视频生成模型积分配置
 *
 * 💡 定价说明（基于 Evolink 1:1 成本，向上取整）:
 *
 * 1. **Veo 3.1 Fast Lite**: 固定 10 积分（基准价格）
 * 2. **Sora 2 Lite**: 10s=2积分, 15s=3积分 (无水印)
 * 3. **Wan 2.6**: 720p: 5s=25积分, 10s=50积分, 15s=75积分
 *              1080p × 1.67 倍
 * 4. **Seedance 1.5 Pro**: 按秒计费, 默认有音频
 *                          480p: 1.636 Credits/秒 → 2 积分/秒
 *                          720p: 3.557 Credits/秒 → 4 积分/秒
 *                          1080p: 7.932 Credits/秒 → 8 积分/秒
 *
 * 计费规则说明：
 * - baseCredits: 基础积分（最短时长、最低画质）
 * - perSecond: 每秒积分（用于按秒计费的模型）
 * - qualityMultiplier: 画质乘数（1080p vs 720p）
 */
export const VIDEO_MODEL_PRICING: Record<string, VideoModelPricing> = {
  // Credit prices are no longer set here: they are computed from KIE's list
  // prices in kie-pricing.ts. This table only controls which models are on
  // sale and their display order. baseCredits / perSecond are unused.
  "veo-3.1": { baseCredits: 0, perSecond: 0, enabled: true },
  "wan2.6": { baseCredits: 0, perSecond: 0, enabled: true },
  // Not on KIE's price list as of 2026-11-18, so there is no verified cost to
  // price them from. Off sale until a cost is confirmed.
  "seedance-1.5-pro": { baseCredits: 0, perSecond: 0, enabled: false },
  "sora-2": { baseCredits: 0, perSecond: 0, enabled: false },
  "seedance-1.0-pro-fast": { baseCredits: 0, perSecond: 0, enabled: false },
  "seedance-1.0-pro-quality": { baseCredits: 0, perSecond: 0, enabled: false },
};

// ============================================
// 五、支付配置（环境变量）
// ============================================

/**
 * 支付提供商配置
 *
 * 这些配置通常在 .env.local 文件中设置
 * 这里只是说明，不需要修改
 */
export const PAYMENT_CONFIG = {
  /** 使用 Creem 支付 */
  provider: "creem",
  /** Creem Webhook URL（用于接收支付状态通知）*/
  webhookUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/creem/webhook`
    : "",
};
