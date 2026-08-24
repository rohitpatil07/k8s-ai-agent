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
      `Previous container logs:\n${logs.logs.trim()}`,
    );
  } else if (logs.reason === "NO_PREVIOUS_CONTAINER") {
    evidence.push(
      "No previous container logs are available.",
    );
  }

  let summary = `Pod ${pod.name} requires investigation.`;
  let rootCause = "Unable to determine the root cause.";
  let recommendation =
    "Inspect the pod state, events, container logs, and termination details.";

  const crashLoopContainer = pod.containers.find(
    container =>
      container.state?.reason === "CrashLoopBackOff",
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