import type { Handle, Outcome, Source } from "./contracts";

export const sourceThree = function (): Source {
  return { name: "three", async resolve(id): Promise<Outcome> { return { kind: "found", content: id }; } };
};

export const handleThree = (): Handle => ({ name: "three", attempts: 2 });

export const outcomeThree = async function (id: string): Promise<Outcome> {
  if (id) return { kind: "found", content: id };
  return { kind: "transient", reason: "unavailable" };
};

export class Factory {
  source(): Source {
    return { name: "method", async resolve(id): Promise<Outcome> { return { kind: "found", content: id }; } };
  }

  handle(): Handle {
    return { name: "method", attempts: 3 };
  }

  async outcome(id: string): Promise<Outcome> {
    if (id) return { kind: "found", content: id };
    return { kind: "transient", reason: "unavailable" };
  }
}
