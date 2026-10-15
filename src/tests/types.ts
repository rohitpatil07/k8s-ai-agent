export interface Scenario {
  name: string;
  evidence: CollectedEvidence;
  expected: RegExp[];
}