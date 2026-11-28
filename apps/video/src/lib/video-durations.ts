/** Inclusive integer seconds accepted by a model whose API documents a range. */
export function secondsBetween(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

/** Keep sparse API enums sparse while presenting continuous models compactly. */
export function durationLabel(seconds: number[], separator = "、"): string {
  if (!seconds.length) return "";
  const continuous = seconds.every((value, index) => index === 0 || value === seconds[index - 1] + 1);
  return continuous && seconds.length > 2
    ? `${seconds[0]}–${seconds[seconds.length - 1]}`
    : seconds.join(separator);
}

export function closestDuration(seconds: number[], value: number): number {
  return seconds.reduce((nearest, next) =>
    Math.abs(next - value) < Math.abs(nearest - value) ? next : nearest, seconds[0]);
}
