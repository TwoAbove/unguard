import type { Handle, Outcome, Source } from "./contracts";

export function sourceOne(): Source {
  return { name: "one", async resolve(id): Promise<Outcome> { return { kind: "found", content: id }; } };
}

export const sourceTwo = (): Source => ({
  name: "two",
  async resolve(id): Promise<Outcome> { return { kind: "found", content: id }; },
});

export function handleOne(): Handle {
  return { name: "one", attempts: 0 };
}

export const handleTwo = function (): Handle {
  return { name: "two", attempts: 1 };
};

export async function outcomeOne(id: string): Promise<Outcome> {
  if (id) return { kind: "found", content: id };
  return { kind: "transient", reason: "unavailable" };
}

export const outcomeTwo = async (id: string): Promise<Outcome> => {
  if (id) return { kind: "found", content: id };
  return { kind: "transient", reason: "unavailable" };
};
