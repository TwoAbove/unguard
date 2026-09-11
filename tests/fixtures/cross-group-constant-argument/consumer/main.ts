import { renderDraft, withOmission, withSpread, withVariable } from "../shared/prompt";

export const prompt = renderDraft("live draft");
withOmission();
declare const args: [string | undefined];
withSpread(...args);
declare const draft: string | undefined;
withVariable(draft);
