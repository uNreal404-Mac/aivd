export const ZCV_PRODUCT = Object.freeze({
  id: "zombie-couple-video",
  name: "AI Zombie Couple Video",
  usdCents: 699,
  currency: "usd",
  durationSec: 10,
  width: 1920,
  height: 1080,
  sound: false,
});

export type ZcvOwner = {
  ownerKind: "user" | "guest";
  userId: number | null;
  guestId: string | null;
};

export type ZcvViewer = {
  userId: number | null;
  guestId: string | null;
};

export type ZcvCheckoutOrder = {
  id: string;
  userId: number;
  checkoutSessionId: string | null;
  productId: string;
  amountTotal: number;
  currency: string;
};

export type StripeCheckoutLike = {
  id?: unknown;
  mode?: unknown;
  payment_status?: unknown;
  status?: unknown;
  amount_total?: unknown;
  currency?: unknown;
  client_reference_id?: unknown;
  metadata?: Record<string, unknown> | null;
};

export function isValidPaidCheckout(session: StripeCheckoutLike, order: ZcvCheckoutOrder): boolean {
  return (
    session.id === order.checkoutSessionId &&
    session.mode === "payment" &&
    session.payment_status === "paid" &&
    session.status === "complete" &&
    order.productId === ZCV_PRODUCT.id &&
    order.amountTotal === ZCV_PRODUCT.usdCents &&
    session.amount_total === order.amountTotal &&
    order.currency.toLowerCase() === ZCV_PRODUCT.currency &&
    String(session.currency || "").toLowerCase() === ZCV_PRODUCT.currency &&
    String(session.client_reference_id || "") === String(order.userId) &&
    session.metadata?.orderId === order.id &&
    session.metadata?.userId === String(order.userId) &&
    session.metadata?.productId === ZCV_PRODUCT.id
  );
}

export function canStartPaidGeneration(status: string): boolean {
  return status === "paid_pending" || status === "video_retry";
}

export function ownershipMatches(owner: ZcvOwner, viewer: ZcvViewer): boolean {
  if (owner.ownerKind === "user") {
    return owner.userId !== null && viewer.userId === owner.userId;
  }
  return owner.guestId !== null && viewer.userId === null && viewer.guestId === owner.guestId;
}

export function shouldMarkNeedsCheck(result: { certainty: "unknown" | "rejected" }): boolean {
  return result.certainty === "unknown";
}
