/** Bounded parallel work with stable output ordering (career data and diagnostics). */
export async function mapPool<T, R>(items: readonly T[], mapper: (item: T) => R | Promise<R>, size = 4): Promise<R[]> {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('Pool size must be a positive integer');
  const output = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}
