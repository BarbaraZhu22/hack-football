export const THEME_STORAGE_KEY = "football-theme";

export const themes = [
  { id: "miami", label: "Miami", description: "Pink & blue" },
  { id: "pitch", label: "Pitch", description: "Black & green" },
  { id: "classic", label: "Classic", description: "Red & white" },
];

export const defaultTheme = "miami";

export function isThemeId(value) {
  return themes.some((theme) => theme.id === value);
}
