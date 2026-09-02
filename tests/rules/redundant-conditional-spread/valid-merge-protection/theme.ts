export interface ThemeUpdate {
  theme?: string;
}

export function currentUpdate(): ThemeUpdate {
  return { theme: "dark" };
}

export function describeUpdate(update: ThemeUpdate): string {
  if (update.theme === undefined) return "unset";
  return update.theme;
}
