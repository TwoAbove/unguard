interface User {
  id: string;
}

// Primitive aliases name a concept; keywords are not type references.
type ID = string;

// Instantiation specializes a generic — real information.
type Users = Array<User>;
type MaybeUser = Partial<User>;

// Shapes, unions, literals, and operators define structure.
type Pair = { left: User; right: User };
type Status = "active" | "inactive";
type Nullable = User | null;
type Keys = keyof User;
type UserConfig = typeof defaultConfig;

// Generic aliases re-parameterize.
type Wrapped<T> = Array<T>;

const defaultConfig = { retries: 3 };

export type { ID, Users, MaybeUser, Pair, Status, Nullable, Keys, UserConfig, Wrapped };
