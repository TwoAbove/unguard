import { report, type NarrowOptions } from "./flow";

export function call(tag: string | undefined): string {
  const options: NarrowOptions = {
    ...(tag === undefined ? {} : { tag }),
  };
  return report(options);
}
