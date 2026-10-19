import { adjust, restore } from "./callee";

adjust(1);
(adjust(2));

export async function reset(): Promise<void> {
  await restore(0);
  void restore(1);
}
