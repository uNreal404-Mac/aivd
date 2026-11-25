// ============================================
// Video Types
// ============================================

export type VideoStatus = "pending" | "generating" | "uploading" | "completed" | "failed";

export interface Video {
  uuid: string;
  userId: string;
  prompt: string;
  model: string;
  provider: string;
  status: VideoStatus;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  /** Every output file (images can come in sets). */
  mediaUrls?: string[];
  duration: number;
  resolution?: string | null;
  aspectRatio: string;
  parameters: Record<string, unknown>;
  creditsUsed: number;
  errorMessage: string | null;
  /** Gallery visibility. Older API responses may omit it (treat as "private"). */
  visibility?: "private" | "public" | null;
  /** Set only while the video is published to the gallery. */
  publishedAt?: Date | null;
  galleryTitle?: string | null;
  galleryDescription?: string | null;
  publicPrompt?: string | null;
  promptProtected?: boolean | null;
  assetsReusable?: boolean | null;
  /** The source image of the original generation, when there was one. */
  startImageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Filter Types
// ============================================

export type CreationMediaType = "video" | "image" | "audio";

export interface VideoFilterOptions {
  /** Which studio's output to list. */
  mediaType?: CreationMediaType;
  status?: VideoStatus | "all";
  model?: string | "all";
  sortBy?: "newest" | "oldest";
}

export interface ListVideosParams {
  limit?: number;
  cursor?: string;
  type?: CreationMediaType;
  status?: VideoStatus;
}

// ============================================
// API Response Types
// ============================================

export interface ListVideosResponse {
  videos: Video[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface VideoResponse {
  video: Video;
}

export interface DeleteVideoResponse {
  success: boolean;
}

export interface RetryVideoResponse {
  success: boolean;
  newVideoUuid: string;
}

// ============================================
// Credit Types
// ============================================

export type CreditTransType =
  | "order_pay"
  | "subscription"
  | "admin_adjust"
  | "video_generate"
  | "video_refund";

export interface CreditTransaction {
  id: string;
  userId: string;
  credits: number;
  balanceAfter: number;
  transType: CreditTransType;
  videoUuid: string | null;
  remark: string | null;
  createdAt: Date;
}

export interface CreditBalance {
  totalCredits: number;
  usedCredits: number;
  frozenCredits: number;
  availableCredits: number;
  expiringSoon: number;
}

export interface CreditHistoryResponse {
  transactions: CreditTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ============================================
// Billing Types
// ============================================

export type InvoiceStatus = "paid" | "pending" | "failed";

export interface InvoiceItem {
  type: "credits" | "subscription";
  description: string;
  quantity: number;
}

export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  createdAt: Date;
  /** The credit package behind this entry. */
  credits?: {
    transType: string;
    initial: number;
    remaining: number;
    expiredAt: string | Date | null;
    status: string;
  };
}

export interface BillingResponse {
  user: {
    email: string;
    id: string;
    createdAt: Date;
  };
  invoices: Invoice[];
  nextCursor: string | null;
  hasMore: boolean;
}
