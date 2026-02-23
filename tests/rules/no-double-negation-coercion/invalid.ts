const x = !!value; // @expect no-double-negation-coercion
const y = !!obj.prop; // @expect no-double-negation-coercion
