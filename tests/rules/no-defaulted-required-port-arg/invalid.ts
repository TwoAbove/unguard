export interface IPort {
  required(arg: string): void;
  fetch(id: string, lang: string): Promise<string>;
}

// BAD: interface marks `arg` required, implementation supplies a default
export class BadSimple implements IPort {
  required(
    arg: string = "fallback", // @expect no-defaulted-required-port-arg
  ): void {
    void arg;
  }
  fetch(
    id: string,
    lang: string = "en", // @expect no-defaulted-required-port-arg
  ): Promise<string> {
    return Promise.resolve(`${id}:${lang}`);
  }
}

interface ILocalPort {
  fetch(id: string, lang: string): Promise<string>;
}

// BAD: same shape via object literal typed against the interface
export const bad_object_literal: ILocalPort = {
  fetch(
    id: string,
    lang: string = "en", // @expect no-defaulted-required-port-arg
  ): Promise<string> {
    return Promise.resolve(`${id}:${lang}`);
  },
};
