import { describe, it, expect } from 'vitest';
import { createStorage } from '../src/services/storage';

describe('safe storage', () => {
  it('reads and writes persistent storage', () => {
    const data = new Map();
    const fake = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } as unknown as Storage;
    const storage = createStorage(() => fake);
    storage.set('theme', 'ferrari');
    expect(data.get('theme')).toBe('ferrari');
    expect(storage.get('theme')).toBe('ferrari');
    storage.remove('theme');
    expect(storage.get('theme')).toBeNull();
  });
  it('works when storage access is denied', () => {
    const storage = createStorage(() => { throw new Error('Denied'); });
    storage.set('selection', 'race');
    expect(storage.get('selection')).toBe('race');
    storage.remove('selection');
    expect(storage.get('selection')).toBeNull();
  });
  it('prefers fresh in-memory writes if persistent storage fills up', () => {
    const fake = { getItem: () => 'old', setItem: () => { throw new Error('Quota'); } } as unknown as Storage;
    const storage = createStorage(() => fake);
    storage.set('selection', 'new');
    expect(storage.get('selection')).toBe('new');
  });
});
