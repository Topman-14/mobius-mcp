import { useEffect, useState } from "react";
import type { StorageSetting } from "../lib/storage.js";

function useLiveSetting<T>(setting: StorageSetting<T>): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    let active = true;
    setting.get().then((v) => active && setValue(v));

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "sync" || !changes[setting.key]) return;
      setting.get().then((v) => active && setValue(v));
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [setting]);

  return [value, setValue];
}

/** For object-shaped settings: update() merges a partial patch onto the current value. */
export function useSyncedSetting<T extends object>(setting: StorageSetting<T>): [T | null, (patch: Partial<T>) => Promise<void>] {
  const [value, setValue] = useLiveSetting(setting);

  const update = async (patch: Partial<T>) => {
    if (!value) return;
    const next = { ...value, ...patch };
    setValue(next);
    await setting.set(next);
  };

  return [value, update];
}

/** For primitive settings (e.g. a string union): update() replaces the value outright. */
export function useSyncedValue<T>(setting: StorageSetting<T>): [T, (value: T) => Promise<void>] {
  const [value, setValue] = useLiveSetting(setting);

  const update = async (next: T) => {
    setValue(next);
    await setting.set(next);
  };

  return [value ?? setting.default, update];
}
