/** The caller owns cancellation. No save, billing or provider request is started by this timer. */
export function submissionDelay(update: (seconds: number) => void, submit: () => void) {
  const timers = [
    setTimeout(() => update(2), 1_000),
    setTimeout(() => update(1), 2_000),
    setTimeout(submit, 3_000),
  ];
  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
