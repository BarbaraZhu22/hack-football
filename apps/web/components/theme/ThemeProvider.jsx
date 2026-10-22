"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  defaultTheme,
  isThemeId,
  THEME_STORAGE_KEY,
  themes,
} from "@/lib/themes";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(defaultTheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isThemeId(stored)) {
      setThemeState(stored);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, ready]);

  function setTheme(next) {
    if (isThemeId(next)) {
      setThemeState(next);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
}
