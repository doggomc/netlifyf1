export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Storage may be denied (private mode) or full. The current tab still works. */
export function createStorage(resolve: () => Storage = () => localStorage): SafeStorage {
  const memory = new Map<string, string>();
  return {
    get(key) {
      if (memory.has(key)) return memory.get(key)!;
      try { return resolve().getItem(key); } catch { return null; }
    },
    set(key, value) {
      memory.set(key, String(value));
      try { resolve().setItem(key, String(value)); memory.delete(key); } catch { /* in-memory fallback */ }
    },
    remove(key) {
      memory.delete(key);
      try { resolve().removeItem(key); } catch { /* unavailable */ }
    }
  };
}
export const store = createStorage();
