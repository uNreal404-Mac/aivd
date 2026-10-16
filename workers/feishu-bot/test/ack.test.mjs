import assert from "node:assert/strict";
import test from "node:test";
import { ACK_FAILURE_TEXT, ACK_SUCCESS_TEXT, ackKey, ackTextFor } from "../src/ack.mjs";

test("exports the fixed acknowledgement texts", () => {
  assert.equal(ACK_SUCCESS_TEXT, "收到，老三正在处理");
  assert.equal(ACK_FAILURE_TEXT, "转发失败，请稍后重试");
});

test("selects the acknowledgement text from the forward result", () => {
  assert.equal(ackTextFor(true), "收到，老三正在处理");
  assert.equal(ackTextFor(false), "转发失败，请稍后重试");
});

test("namespaces the per-message acknowledgement dedupe key", () => {
  assert.equal(ackKey("om_1"), "feishu:acked:message:om_1");
});
