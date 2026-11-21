// Mandarin Grove — mandarin orange / forest green / crest yellow on a warm
// cream (light) or deep forest (dark) base. Light and dark are two
// complete palettes with the same keys, resolved at render time by
// useTheme() — never import a flat `colors` object directly, since that
// can't react to a theme change. Keep this file in sync with the web
// app's src/index.css if the palette changes.
import { useCallback, useContext, useEffect, useMemo, useState, createContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { loadFromStorage, saveToStorage } from "./lib/storage";

export type ThemeMode = "system" | "light" | "dark";
type EffectiveMode = "light" | "dark";

const lightColors = {
  bg: "#FFF8E8",
  surface: "#FFFFFF",
  border: "#FFE8B8",
  textPrimary: "#1F3D2B",
  textBody: "#2B4A36",
  textTertiary: "#3F5F49",
  textSecondary: "#6B8F77",
  textMuted: "#8AA68F",
  textFaint: "#C7D9C9",
  iconEmpty: "#E3EEE0",
  primaryBg: "#FF6B2C",
  primaryText: "#FFFFFF",
  stamp: "#D93A2B",
  tape: "#FFCB05",
};

const darkColors = {
  bg: "#1C2A1E",
  surface: "#263A28",
  border: "#3A4F38",
  textPrimary: "#FFF6E8",
  textBody: "#EDE4D2",
  textTertiary: "#CBDCC6",
  textSecondary: "#9DB49A",
  textMuted: "#7E9A7C",
  textFaint: "#4C6349",
  iconEmpty: "#35492F",
  primaryBg: "#FF7A3D",
  primaryText: "#FFFFFF",
  stamp: "#FF6B5C",
  tape: "#FFCB05",
};

export type Colors = typeof lightColors;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const spacing = (n: number) => n * 4;

const THEME_MODE_KEY = "themeMode";

const ThemeContext = createContext<{
  mode: ThemeMode;
  effectiveMode: EffectiveMode;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    loadFromStorage<ThemeMode>(THEME_MODE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    saveToStorage(THEME_MODE_KEY, next);
  }, []);

  const effectiveMode: EffectiveMode = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const colors = effectiveMode === "dark" ? darkColors : lightColors;

  const value = useMemo(() => ({ mode, effectiveMode, colors, setMode }), [mode, effectiveMode, colors, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() must be called within a ThemeProvider");
  return ctx;
}
