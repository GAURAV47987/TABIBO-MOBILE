// Postcard Pop theme — same palette as the web app's src/index.css,
// ported to a plain JS object since React Native has no CSS custom
// properties. Keep these two files in sync if the palette changes.
export const colors = {
  bg: "#FBF8FF",
  surface: "#FFFFFF",
  border: "#EDE7FA",
  textPrimary: "#241E3D",
  textBody: "#3A3159",
  textTertiary: "#5B5380",
  textSecondary: "#7A72A3",
  textMuted: "#8680AC",
  textFaint: "#C3BEDE",
  iconEmpty: "#D8D3EE",
  primaryBg: "#7C5CFC",
  primaryText: "#FFFFFF",
  stamp: "#DB2450",
  tape: "#FFD23F",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const spacing = (n: number) => n * 4;
