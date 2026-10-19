declare const betaInput: { id: string; severity: string; message: string; filename: string; line: number; };

export const beta = {
  [("right")]: betaInput.id,
  severity: betaInput.severity,
  message: betaInput.message,
  filename: betaInput.filename,
  line: betaInput.line,
};
