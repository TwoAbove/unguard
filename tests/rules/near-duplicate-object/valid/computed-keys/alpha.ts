declare const alphaInput: { id: string; severity: string; message: string; filename: string; line: number; };

export const alpha = {
  [("left")]: alphaInput.id,
  severity: alphaInput.severity,
  message: alphaInput.message,
  filename: alphaInput.filename,
  line: alphaInput.line,
};
