export const ACK_TTL_SECONDS = 604800;

// The acknowledgement is one of two fixed texts chosen only by whether the forward
// succeeded. It never summarises the user's message, so it can neither echo a
// commitment back nor leak model output.
export const ACK_SUCCESS_TEXT = "收到，老三正在处理";
export const ACK_FAILURE_TEXT = "转发失败，请稍后重试";

export function ackTextFor(forwardOk) {
  return forwardOk ? ACK_SUCCESS_TEXT : ACK_FAILURE_TEXT;
}

export function ackKey(messageId) {
  return `feishu:acked:message:${messageId}`;
}
