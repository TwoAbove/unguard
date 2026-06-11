interface User {
  id: string;
}

type Person = User; // @expect trivial-type-alias

type Account = Person; // @expect trivial-type-alias

class Service {}
type Svc = Service; // @expect trivial-type-alias

export type { Account, Svc };
