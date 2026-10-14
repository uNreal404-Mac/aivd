import assert from "node:assert/strict";
import test from "node:test";
import {
  ZCV_PRODUCT,
  canStartPaidGeneration,
  isValidPaidCheckout,
  ownershipMatches,
  shouldMarkNeedsCheck,
} from "../libs/zcvCore";

test("the one-time product catalog freezes the task-card offer", () => {
  assert.deepEqual(ZCV_PRODUCT, {
    id: "zombie-couple-video",
    name: "AI Zombie Couple Video",
    usdCents: 699,
    currency: "usd",
    durationSec: 10,
    width: 1920,
    height: 1080,
    sound: false,
  });
});

test("checkout validation accepts only paid one-time USD sessions for the order amount", () => {
  const valid = {
    id: "cs_test_123",
    mode: "payment",
    payment_status: "paid",
    status: "complete",
    amount_total: 699,
    currency: "usd",
    client_reference_id: "42",
    metadata: { orderId: "ord_abc", userId: "42", productId: ZCV_PRODUCT.id },
  };
  const order = { id: "ord_abc", userId: 42, checkoutSessionId: "cs_test_123", productId: ZCV_PRODUCT.id, amountTotal: 699, currency: "usd" };
  assert.equal(isValidPaidCheckout(valid, order), true);
  assert.equal(isValidPaidCheckout({ ...valid, amount_total: 1 }, order), false);
  assert.equal(isValidPaidCheckout({ ...valid, mode: "subscription" }, order), false);
  assert.equal(isValidPaidCheckout({ ...valid, payment_status: "unpaid" }, order), false);
  assert.equal(isValidPaidCheckout({ ...valid, metadata: { ...valid.metadata, userId: "7" } }, order), false);
  assert.equal(isValidPaidCheckout(valid, { ...order, amountTotal: 1 }), false);
  assert.equal(isValidPaidCheckout(valid, { ...order, productId: "other-product" }), false);
});

test("only paid pending or explicitly retryable orders can claim generation", () => {
  assert.equal(canStartPaidGeneration("paid_pending"), true);
  assert.equal(canStartPaidGeneration("video_retry"), true);
  for (const state of ["checkout_pending", "video_starting", "generating", "needs_check", "delivered", "refunded"]) {
    assert.equal(canStartPaidGeneration(state), false, state);
  }
});

test("private asset ownership distinguishes the signed-in user and guest cookie", () => {
  assert.equal(ownershipMatches({ ownerKind: "user", userId: 42, guestId: null }, { userId: 42, guestId: null }), true);
  assert.equal(ownershipMatches({ ownerKind: "user", userId: 42, guestId: null }, { userId: 7, guestId: null }), false);
  assert.equal(ownershipMatches({ ownerKind: "guest", userId: null, guestId: "gst_a" }, { userId: null, guestId: "gst_a" }), true);
  assert.equal(ownershipMatches({ ownerKind: "guest", userId: null, guestId: "gst_a" }, { userId: null, guestId: "gst_b" }), false);
  assert.equal(ownershipMatches({ ownerKind: "guest", userId: null, guestId: "gst_a" }, { userId: 42, guestId: "gst_a" }), false);
});

test("unknown KIE create outcomes require reconciliation and cannot be retried blindly", () => {
  assert.equal(shouldMarkNeedsCheck({ certainty: "unknown" }), true);
  assert.equal(shouldMarkNeedsCheck({ certainty: "rejected" }), false);
});
