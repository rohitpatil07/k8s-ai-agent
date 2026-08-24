export interface PodSummary {
  name: string;
  namespace: string;
  phase?: string;
  ready: boolean;
  restartCount: number;
  node?: string;
  podIP?: string;

  containers: {
    name: string;
    ready: boolean;
    restartCount: number;

    state?: {
      type: "waiting" | "running" | "terminated";
      reason?: string;
      message?: string;
      exitCode?: number;
      startedAt?: Date;
    };
  }[];
}

export interface PodDetail {
  name: string;
  namespace: string;
  phase?: string;

  node?: string;
  podIP?: string;

  containers: {
    name: string;
    image?: string;
    ready: boolean;
    restartCount: number;

    state?: {
      type: "waiting" | "running" | "terminated";
      reason?: string;
      message?: string;
      exitCode?: number;
      signal?: number;
      startedAt?: Date;
      finishedAt?: Date;
    };

    lastState?: {
    type: "terminated";
    reason?: string;
    message?: string;
    exitCode?: number;
    signal?: number;
    startedAt?: Date;
    finishedAt?: Date;
  };
  }[];
}

export interface PodLogs {
  logs: string | null;
  reason?:
    | "NO_PREVIOUS_CONTAINER"
    | "LOG_RETRIEVAL_FAILED";
  error?: string;
}

export interface PodEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp?: Date;
  lastTimestamp?: Date;
  component: string;
}

export interface DiagnosticContext {
  pod: PodDetail;
  events: PodEvent[];
  logs: PodLogs;
}

export interface Diagnosis {
  summary: string;
  rootCause: string;
  evidence: string[];
  recommendation: string;
}