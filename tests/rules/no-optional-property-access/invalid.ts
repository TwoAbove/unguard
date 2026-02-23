const x = obj?.prop; // @expect no-optional-property-access
const y = obj?.nested?.deep; // @expect no-optional-property-access
