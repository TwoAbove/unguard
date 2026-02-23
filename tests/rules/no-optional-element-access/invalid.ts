const x = arr?.[0]; // @expect no-optional-element-access
const y = obj?.["key"]; // @expect no-optional-element-access
