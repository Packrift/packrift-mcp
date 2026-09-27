/** Bound optional cache/telemetry work. A stalled optimization must not stall a buyer. */
export async function bestEffort<T>(operation: () => Promise<T>, fallback: T, timeoutMs = 500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
