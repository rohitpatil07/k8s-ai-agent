import type {
  PodDetail,
  PodEvent,
  PodLogs,
} from "../kubernetes/types.js";

export interface CollectedEvidence {
  pod: PodDetail;
  events: PodEvent[];
  logs: PodLogs;
}

export type Confidence = "low" | "medium" | "high";

export interface DiagnosticCheck {
  command: string;
  reason: string;
}

export interface AIAnalysis {
  assessment: string;
  likelyCause: string;
  confidence: Confidence;
  supportingEvidence: string[];
  uncertainties: string[];
  nextChecks: DiagnosticCheck[];
}