/** The composer, return drafts and studio URLs use the model's actual batch limit. */
export function imageOutputCount(value: unknown, maxCount = 1): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(1, maxCount));
}
