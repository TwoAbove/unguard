import {
  contextual,
  explicitlyMissing,
  optionalInstead,
  overloaded,
  passedAsValue,
  receivesAny,
  sometimesMissing,
} from "./callee";

declare const maybeName: string | undefined;
declare const raw: string;

sometimesMissing("Alice");
sometimesMissing(maybeName);

explicitlyMissing("Alice");
explicitlyMissing(null);

passedAsValue("Alice");
["Bob"].map(passedAsValue);

optionalInstead("Alice");

receivesAny(JSON.parse(raw));

overloaded("Alice");

contextual("Alice");
