export function formatLabel(value: string): string {
  return value.trim();
}

export type LabelOptions = {
  upper: boolean;
};

export const LABEL_SEPARATOR = ": ";
