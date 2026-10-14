import type { Diagnosis } from "../kubernetes/types.js";

export function buildDiagnosisPrompt(
  podName: string,
  namespace: string,
  diagnosis: Diagnosis,
): string {
  return `
You are a Kubernetes troubleshooting assistant.

Review the rule-based diagnosis using only the supplied evidence.

Rules:
- Do not invent facts or claim you ran commands.
- Separate observed facts from possible causes.
- If evidence is insufficient, say so.
- Recommend only safe, read-only diagnostic checks.
- Do not suggest changing or deleting cluster resources.
- Keep your response concise.

Pod: ${podName}
Namespace: ${namespace}

Rule-based diagnosis:
${JSON.stringify(diagnosis, null, 2)}

Return these sections:
1. Assessment
2. Likely cause
3. Supporting evidence
4. Next safe checks
`.trim();
}