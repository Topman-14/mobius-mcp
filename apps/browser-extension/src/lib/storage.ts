export interface StorageSetting<T> {
  key: string;
  default: T;
  get(): Promise<T>;
  set(value: T): Promise<void>;
}

export function defineSetting<T>(key: string, defaultValue: T): StorageSetting<T> {
  return {
    key,
    default: defaultValue,
    async get() {
      const result = await chrome.storage.sync.get(key);
      const stored = result[key];
      if (stored === undefined) return defaultValue;
      if (typeof defaultValue === "object" && defaultValue !== null) return { ...defaultValue, ...stored };
      return stored as T;
    },
    async set(value: T) {
      await chrome.storage.sync.set({ [key]: value });
    },
  };
}
