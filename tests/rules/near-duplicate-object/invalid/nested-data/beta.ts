interface Input {
  id: string;
  severity: string;
  message: string;
  filename: string;
  line: number;
  detail: { code: string; category: string; start: number; end: number; text: string; };
}
declare const betaInput: Input;

export const betaDiagnostic = { // @expect near-duplicate-object
  id: betaInput.id,
  severity: betaInput.severity,
  message: betaInput.message,
  filename: betaInput.filename,
  line: betaInput.line,
  detail: {
    code: betaInput.detail.code,
    category: betaInput.detail.category,
    start: betaInput.detail.start,
    end: betaInput.detail.end,
    text: betaInput.detail.text,
  },
};
