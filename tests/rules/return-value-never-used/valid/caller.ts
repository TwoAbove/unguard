import { generic, onlyOneCaller, passedAsValue, registered, resolvesNothing, returnsNothing, sometimesRead } from "./callee";

sometimesRead(1);
export const total = sometimesRead(2);

returnsNothing(1);
returnsNothing(2);

export async function reset(): Promise<void> {
  await resolvesNothing(0);
  await resolvesNothing(1);
}

onlyOneCaller(1);

passedAsValue(1);
passedAsValue(2);
[3].forEach(passedAsValue);

generic(() => undefined);
generic(() => {});

registered.save(1);
registered.save(2);
