"use client";

import { useEffect } from "react";
import { defaultTheme, THEME_STORAGE_KEY } from "@/lib/themes";

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.dataset.theme = defaultTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, defaultTheme);
    } catch {
      // The fixed skin still works when storage is unavailable.
    }
  }, []);

  return children;
}
