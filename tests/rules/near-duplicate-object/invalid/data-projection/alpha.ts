declare const alphaInput: { id: string; message: string; filename: string; line: number; column: number; };

export const alphaDiagnostic = {
  id: alphaInput.id,
  severity: "warning" as const,
  message: alphaInput.message,
  filename: alphaInput.filename,
  line: alphaInput.line,
  column: alphaInput.column,
  extra: undefined,
};
