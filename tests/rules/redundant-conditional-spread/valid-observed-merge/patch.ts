export interface ThemePatch {
  theme?: string;
}

export function apply(patch: ThemePatch): { theme: string } {
  return { theme: "light", ...patch };
}
