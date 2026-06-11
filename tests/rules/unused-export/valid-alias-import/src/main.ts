// Imports resolve through the tsconfig path alias; textual resolution cannot
// see these, the checker can.
import { formatLabel, LABEL_SEPARATOR, type LabelOptions } from "@/format";

function main(options: LabelOptions): string {
  return formatLabel("x") + LABEL_SEPARATOR + String(options.upper);
}

main({ upper: true });
