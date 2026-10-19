declare const betaInput: { id: string; message: string; filename: string; line: number; column: number; };

export const betaDiagnostic = { // @expect near-duplicate-object
  id: betaInput.id,
  severity: "warning" as const,
  message: betaInput.message,
  filename: betaInput.filename,
  line: betaInput.line,
  column: betaInput.column,
  extra: undefined,
};
