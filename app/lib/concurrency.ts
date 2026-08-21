/**
 * Maps over `items` with at most `limit` tasks in flight, preserving order.
 *
 * Batch generation is CPU-bound in libvips; running everything at once starves
 * the event loop and makes the request look hung, while running one at a time
 * wastes cores.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await task(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
