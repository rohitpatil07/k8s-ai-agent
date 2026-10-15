import type { CollectedEvidence } from "../src/ai/types.js";

export interface Scenario {
  name: string;
  evidence: CollectedEvidence;
  expected: RegExp[];
  expectedCheck?: boolean;
}