import type { ObjectLiteralTemplateFact } from "../../graph/types.ts";
import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

const MIN_TEMPLATE_SIZE = 50;
const MIN_FUNCTION_BODY_SIZE = 20;
const MIN_DATA_OPERATIONS = 5;

type TemplateGroup = [ObjectLiteralTemplateFact, ...ObjectLiteralTemplateFact[]];

export const nearDuplicateObject: CrossFileRule = {
  id: "near-duplicate-object",
  severity: "warning",
  message: "Near-duplicate object implementations; build them with one factory",

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const groups = new Map<string, TemplateGroup>();
    for (const entry of graph.objectLiteralTemplates()) {
      const template = entry.template;
      const candidate = template.functionMembers === 0
        ? template.accessCallCount >= MIN_DATA_OPERATIONS
        : template.functionMembers >= 2 && template.size >= MIN_TEMPLATE_SIZE &&
          template.functionBodySize >= MIN_FUNCTION_BODY_SIZE;
      if (!candidate) continue;
      const group = groups.get(template.fingerprint);
      if (group === undefined) groups.set(template.fingerprint, [entry]);
      else group.push(entry);
    }
    const candidates: TemplateGroup[] = [];
    const reportableFiles = context.reportableFiles;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const values = new Set(group.map((entry) => JSON.stringify([
        entry.template.freeDeclarations,
        entry.template.literals,
      ])));
      if (values.size < 2) continue;
      if (reportableFiles !== undefined &&
        !group.some((entry) => reportableFiles.has(entry.site.file))) continue;
      candidates.push(group);
    }
    const diagnostics: Diagnostic[] = [];
    for (const group of candidates) {
      const nested = candidates.some((outer) => outer !== group && group.every((entry) =>
        outer.some((parent) => parent.site.file === entry.site.file &&
          parent.site.start <= entry.site.start && parent.site.end >= entry.site.end &&
          (parent.site.start < entry.site.start || parent.site.end > entry.site.end))
      ));
      if (nested) continue;
      const construction = group[0].template.functionMembers === 0 ? "construction" : "methods";
      reportDuplicateGroup(group.map((entry) => entry.site), this.id, this.severity,
        (entry) => `${entry.file}:${entry.line}`,
        (_entry, others) => `Object literal has the same ${construction} as: ${others}; only the values it references differ — build them with one factory`,
        diagnostics, context);
    }
    return diagnostics;
  },
};
