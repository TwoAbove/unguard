type Options = { a: number; b: string };
function f(opts: Options): void {}
const x: string = "hello";

interface Repository {
  findById(params: { id: string; includeDeleted: boolean }): Promise<unknown>;
  create(data: { name: string; email: string }): Promise<unknown>;
}

interface Extended extends Repository {
  update(params: { id: string; fields: Record<string, unknown> }): Promise<unknown>;
}

class Service implements Repository {
  findById(params: { id: string; includeDeleted: boolean }): Promise<unknown> {
    return Promise.resolve(null);
  }
  create(data: { name: string; email: string }): Promise<unknown> {
    return Promise.resolve(null);
  }
}

const builder = {
  commands: {
    complete: (state: unknown, payload: { type: string }): { id: string } => {
      return { id: "1" };
    },
  },
};
