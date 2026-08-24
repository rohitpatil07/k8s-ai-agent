import type {
  AIContext,
  PodDetail,
  PodEvent,
  PodLogs,
  Diagnosis,
} from "../kubernetes/types.js";

export function buildAIContext(
  pod: PodDetail,
  events: PodEvent[],
  logs: PodLogs,
  diagnosis: Diagnosis,
): AIContext {
  return {
    pod,
    events,
    logs,
    diagnosis,
  };
}