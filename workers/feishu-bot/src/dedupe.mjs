export const DEDUPE_TTL_SECONDS = 604800;

export function dedupeKeys(eventId, messageId) {
  if (typeof eventId !== "string" || !eventId || typeof messageId !== "string" || !messageId) {
    throw new TypeError("Both event_id and message_id are required");
  }
  return [
    `feishu:processed:event:${eventId}`,
    `feishu:processed:message:${messageId}`,
  ];
}

export async function hasProcessed(kv, eventId, messageId) {
  const keys = dedupeKeys(eventId, messageId);
  const results = await Promise.all(keys.map((key) => kv.get(key)));
  return results.some((value) => value !== null && value !== undefined);
}

export async function markProcessed(kv, eventId, messageId) {
  const keys = dedupeKeys(eventId, messageId);
  await Promise.all(keys.map((key) => kv.put(key, "1", { expirationTtl: DEDUPE_TTL_SECONDS })));
}
