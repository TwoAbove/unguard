interface Input {
  id: string;
  severity: string;
  message: string;
  filename: string;
  line: number;
  detail: { code: string; category: string; start: number; end: number; text: string; };
}
declare const alphaInput: Input;

export const alphaDiagnostic = {
  id: alphaInput.id,
  severity: alphaInput.severity,
  message: alphaInput.message,
  filename: alphaInput.filename,
  line: alphaInput.line,
  detail: {
    code: alphaInput.detail.code,
    category: alphaInput.detail.category,
    start: alphaInput.detail.start,
    end: alphaInput.detail.end,
    text: alphaInput.detail.text,
  },
};
