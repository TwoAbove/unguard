import { currentUpdate, describeUpdate, type ThemeUpdate } from "./theme";

export function merge(theme: string | undefined): string {
  const next: ThemeUpdate = {
    ...currentUpdate(),
    ...(theme === undefined ? {} : { theme }),
  };
  return describeUpdate(next);
}
