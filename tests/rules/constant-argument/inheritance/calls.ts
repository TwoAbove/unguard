interface Contract {
  shared(value?: number): number | undefined;
}
class Base {
  shared(value?: number) { return value; }
}
class Middle extends Base {}
class Derived extends Middle implements Contract {
  shared(value?: number) { return value; }
  own(value: number) { return value; } // @expect constant-argument
}
const derived = new Derived();
derived.shared(1);
derived.shared(1);
derived.shared(1);
const base: Base = derived;
base.shared();
base.shared(2);
const contract: Contract = derived;
contract.shared();
contract.shared(3);
derived.own(7);
derived.own(7);
derived.own(7);

class OptionalBase {
  omitted(value?: number) { return value; }
}
class OptionalDerived extends OptionalBase {
  omitted(value?: number) { return value; }
}
const optional = new OptionalDerived();
optional.omitted();
optional.omitted();
optional.omitted();
const optionalBase: OptionalBase = optional;
optionalBase.omitted(2);
