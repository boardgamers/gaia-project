/**
 * Retries `fn` on rejection, waiting `delaysMs[attempt]` between attempts, until it succeeds or
 * the delay list is exhausted. Never rejects itself - a final failure after all retries is only
 * reported via `onGiveUp` (defaults to a no-op), matching call sites that want "try quietly in the
 * background, next trigger will try again anyway" rather than surfacing a scary error for what's
 * often just a transient blip (e.g. a mobile device's radio not yet back after resuming from
 * background - see hosted.ts's resyncWithRetry).
 */
export async function retryWithBackoff(
  fn: () => Promise<void>,
  delaysMs: number[],
  onGiveUp: (err: unknown) => void = () => undefined
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (attempt >= delaysMs.length) {
        onGiveUp(err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}
