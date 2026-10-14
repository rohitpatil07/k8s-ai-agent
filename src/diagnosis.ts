import type {
  DiagnosticContext,
  Diagnosis,
} from "./kubernetes/types.js";

export function diagnose(
  context: DiagnosticContext,
): Diagnosis {
  const { pod, events, logs } = context;

  const evidence: string[] = [];

  // Find containers that are currently failing.
  const failingContainers = pod.containers.filter(
    container =>
      container.state?.reason === "CrashLoopBackOff" ||
      container.state?.reason === "Error" ||
      container.state?.type === "terminated",
  );

  for (const container of failingContainers) {
    evidence.push(
      `Container ${container.name} is unhealthy: ` +
      `state=${container.state?.type}, ` +
      `reason=${container.state?.reason ?? "unknown"}, ` +
      `restartCount=${container.restartCount}.`,
    );
  }

  // Look for Kubernetes restart/backoff events.
  const backOffEvents = events.filter(
    event =>
      event.reason === "BackOff" ||
      event.reason === "CrashLoopBackOff",
  );

  for (const event of backOffEvents) {
    evidence.push(
      `Kubernetes event: ${event.message}`,
    );
  }

  // Include previous container logs because they are
  // particularly important for CrashLoopBackOff.
  if (logs.logs) {
    evidence.push(
      `Container logs:\n${logs.logs.trim()}`,
    );
  } else if (logs.reason === "NO_PREVIOUS_CONTAINER") {
    evidence.push(
      "No previous container logs are available.",
    );
  }

  // A running pod with all containers ready and no
  // failure or backoff signals is considered healthy.
  const allContainersReady =
    pod.containers.length > 0 &&
    pod.containers.every(container => container.ready);

  if (
    pod.phase === "Running" &&
    allContainersReady &&
    failingContainers.length === 0 &&
    backOffEvents.length === 0
  ) {
    evidence.push(
      "Pod is Running, all containers are ready, and no container failure or backoff signals were detected.",
    );

    return {
      summary: `Pod ${pod.name} is healthy.`,
      rootCause: "No failure detected in the collected evidence.",
      evidence,
      recommendation:
        "No action required. Continue monitoring the pod.",
    };
  }

  let summary = `Pod ${pod.name} requires investigation.`;
  let rootCause = "Unable to determine the root cause.";
  let recommendation =
    "Inspect the pod state, events, container logs, and termination details.";

  const crashLoopContainer = pod.containers.find(
    container =>
      container.state?.reason === "CrashLoopBackOff" ||
      container.state?.type === "terminated",
  ) ?? (
    backOffEvents.length > 0
      ? failingContainers[0]
      : undefined
  );

  if (crashLoopContainer) {
    summary =
      `Container ${crashLoopContainer.name} is in CrashLoopBackOff.`;

    if (
      logs.logs &&
      logs.logs.toLowerCase().includes("crashed")
    ) {
      rootCause =
        `The ${crashLoopContainer.name} container is repeatedly ` +
        `crashing. The previous container logs indicate that the ` +
        `application itself crashed, causing Kubernetes to restart it.`;

      recommendation =
        "Inspect the application error immediately before the crash " +
        "and check the container exit code to determine why the " +
        "application is terminating.";
    } else {
      rootCause =
        `The ${crashLoopContainer.name} container is repeatedly ` +
        `terminating and Kubernetes is backing off before restarting it.`;

      recommendation =
        "Inspect the previous container logs and termination details " +
        "to determine why the container is exiting.";
    }
  }

  return {
    summary,
    rootCause,
    evidence,
    recommendation,
  };
}