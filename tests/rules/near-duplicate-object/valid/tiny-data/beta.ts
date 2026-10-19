declare const betaInput: { id: string; message: string; filename: string; line: number; };

export const betaDiagnostic = {
  id: betaInput.id,
  message: betaInput.message,
  filename: betaInput.filename,
  line: betaInput.line,
};
