import { useEffect } from "react";
import { useSyncedValue } from "./use-setting.js";
import { defineSetting } from "../lib/storage.js";

export type ThemeSetting = "system" | "dark" | "light";

export const themeSetting = defineSetting<ThemeSetting>("theme", "system");

function resolveDark(theme: ThemeSetting): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme(): [ThemeSetting, (theme: ThemeSetting) => void] {
  const [theme, setTheme] = useSyncedValue(themeSetting);

  useEffect(() => {
    applyDark(resolveDark(theme));
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => applyDark(resolveDark(theme));
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [theme]);

  return [theme, setTheme];
}
