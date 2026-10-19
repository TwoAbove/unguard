declare const betaRule: { id: string };
declare const betaSeverity: string;
declare const betaFunction: {
  name: string;
  references: readonly string[];
  site: { file: string; line: number; column: number };
};

export const betaDiagnostic = { // @expect near-duplicate-object
  ruleId: betaRule.id,
  severity: betaSeverity,
  message: `Found ${betaFunction.references.length} references to ${betaFunction.name.toUpperCase()}`,
  file: betaFunction.site.file,
  line: betaFunction.site.line,
  column: betaFunction.site.column,
};
