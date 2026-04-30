export interface IPort {
  required(arg: string): void;
  optional(arg?: string): void;
  twoArgs(a: string, b: number): void;
}

// OK: no implements clause, default is the contract
export class FreeStanding {
  method(arg: string = "default"): void {
    void arg;
  }
}

// OK: impl matches required-ness, no default
export class OkNoDefaults implements IPort {
  required(arg: string): void {
    void arg;
  }
  optional(arg?: string): void {
    void arg;
  }
  twoArgs(a: string, b: number): void {
    void a;
    void b;
  }
}

// OK: default placed on a parameter the interface declares optional
export class OkDefaultOnOptional implements IPort {
  required(arg: string): void {
    void arg;
  }
  optional(arg = "fallback"): void {
    void arg;
  }
  twoArgs(a: string, b: number): void {
    void a;
    void b;
  }
}

// OK: standalone function with default — no interface contract to violate
export function ok_freestanding_with_default(arg: string = "en"): string {
  return arg;
}

interface ILocalPort {
  fetch(id: string): Promise<string>;
}

// OK: implements via inline type — required param, no default
export const ok_object_literal_no_default: ILocalPort = {
  fetch(id: string): Promise<string> {
    return Promise.resolve(id);
  },
};
