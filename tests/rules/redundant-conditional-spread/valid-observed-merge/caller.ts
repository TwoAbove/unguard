import { apply, type ThemePatch } from "./patch";

export function call(theme: string | undefined): { theme: string } {
  const patch: ThemePatch = {
    ...(theme === undefined ? {} : { theme }),
  };
  return apply(patch);
}
