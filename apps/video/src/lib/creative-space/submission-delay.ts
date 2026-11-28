/** The caller owns cancellation. No save, billing or provider request is started by this timer. */
export function submissionDelay(update: (seconds: number) => void, submit: () => void, seconds = 3) {
  const duration = Math.max(1, Math.min(5, Math.round(seconds)));
  const timers = Array.from({ length: duration - 1 }, (_, index) =>
    setTimeout(() => update(duration - index - 1), (index + 1) * 1_000));
  timers.push(setTimeout(submit, duration * 1_000));
  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
