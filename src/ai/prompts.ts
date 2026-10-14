
import type { Diagnosis } from "../kubernetes/types.js";
import type { CollectedEvidence } from "./types.js"

export function buildDiagnosisPrompt(
  podName: string,
  namespace: string,
  diagnosis: Diagnosis,
  collectedEvidence: CollectedEvidence,
): string {
  return `
You are a Kubernetes troubleshooting assistant.

Analyze the collected Kubernetes evidence and review the
rule-based diagnosis.

IMPORTANT RULES:
- Use only facts explicitly present in the supplied data.
- Never claim you inspected logs, events, or fields unless
  they appear in the supplied evidence.
- Distinguish observed facts from hypotheses.
- Do not assume that missing evidence means no errors exist.
- If evidence is insufficient, clearly say so.
- Do not invent resource names, events, or error messages.
- Recommend only safe, read-only diagnostic commands.
- Never recommend modifying or deleting cluster resources.
- Keep the analysis concise and technically accurate.

Pod: ${podName}
Namespace: ${namespace}

COLLECTED POD DATA:
${JSON.stringify(collectedEvidence.pod, null, 2)}

COLLECTED KUBERNETES EVENTS:
${JSON.stringify(collectedEvidence.events, null, 2)}

COLLECTED CONTAINER LOGS:
${JSON.stringify(collectedEvidence.logs, null, 2)}

EXISTING RULE-BASED DIAGNOSIS:
${JSON.stringify(diagnosis, null, 2)}

Return these sections:

1. Assessment
2. Likely cause
3. Supporting evidence
4. Evidence gaps or uncertainties
5. Next safe diagnostic checks
`.trim();
}
