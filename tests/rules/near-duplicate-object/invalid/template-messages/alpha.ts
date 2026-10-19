declare const alphaRule: { id: string };
declare const alphaSeverity: string;
declare const alphaFunction: {
  name: string;
  references: readonly string[];
  site: { file: string; line: number; column: number };
};

export const alphaDiagnostic = {
  ruleId: alphaRule.id,
  severity: alphaSeverity,
  message: `Unused declaration ${alphaFunction.name}`,
  file: alphaFunction.site.file,
  line: alphaFunction.site.line,
  column: alphaFunction.site.column,
};
