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
      container.state?.reason === "ImagePullBackOff" ||
      container.state?.reason === "ErrImagePull" ||
      container.state?.reason === "InvalidImageName" ||
      container.state?.reason === "CreateContainerConfigError" ||
      container.state?.reason === "CreateContainerError" ||
      container.state?.reason === "Error" ||
      container.state?.type === "terminated"
  );

  
  for (const container of failingContainers) {
    evidence.push(
      `Container ${container.name} is unhealthy: ` +
      `state=${container.state?.type}, ` +
      `reason=${container.state?.reason ?? "unknown"}, ` +
      `exitCode=${container.state?.exitCode ?? "unknown"}, ` +
      `restartCount=${container.restartCount}.`,
    );

    if (container.lastState) {
      evidence.push(
        `Previous termination for ${container.name}: ` +
        `state=${container.lastState.type}, ` +
        `reason=${container.lastState.reason ?? "unknown"}, ` +
        `exitCode=${container.lastState.exitCode ?? "unknown"}.`,
      );
    }
  }

  // Preserve previous termination details for recovered containers.
  for (const container of pod.containers) {
    if (
      !failingContainers.includes(container) &&
      container.lastState?.type === "terminated"
    ) {
      evidence.push(
        `Historical termination for ${container.name}: ` +
        `reason=${container.lastState.reason ?? "unknown"}, ` +
        `exitCode=${container.lastState.exitCode ?? "unknown"}, ` +
        `restartCount=${container.restartCount}.`,
      );
    }
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

  const imagePullContainer = pod.containers.find(
    container =>
      container.state?.reason === "ImagePullBackOff" ||
      container.state?.reason === "ErrImagePull" ||
      container.state?.reason === "InvalidImageName",
  );

  if (imagePullContainer) {
    const reason = imagePullContainer.state?.reason;
    const message = imagePullContainer.state?.message;

    evidence.push(
      `Image-pull failure for container ${imagePullContainer.name}: ` +
      `reason=${reason}, ` +
      `message=${message ?? "No detailed message available"}.`,
    );

    return {
      summary: `Container ${imagePullContainer.name} cannot pull its image.`,
      rootCause:
        message ??
        `Kubernetes reported ${reason}, indicating that the container image could not be retrieved or resolved.`,
      evidence,
      recommendation:
        "Verify the image name and tag, registry availability, and image-pull credentials. Check pod events for the exact registry error.",
    };
  }

  
  const configErrorContainer = pod.containers.find(
    container =>
      container.state?.reason === "CreateContainerConfigError" ||
      container.state?.reason === "CreateContainerError",
  );

  if (configErrorContainer) {
    const reason = configErrorContainer.state?.reason;
    const message = configErrorContainer.state?.message;

    evidence.push(
      `Container configuration failure for ${configErrorContainer.name}: ` +
      `reason=${reason}, ` +
      `message=${message ?? "No detailed message available"}.`,
    );

    return {
      summary:
        `Container ${configErrorContainer.name} cannot be created because of a configuration error.`,
      rootCause:
        message ??
        `Kubernetes reported ${reason}, but the detailed cause was not available.`,
      evidence,
      recommendation:
        "Inspect the pod description and recent events. Verify referenced ConfigMaps, Secrets, environment variables, volumes, and other container configuration.",
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
      crashLoopContainer.state?.reason === "CrashLoopBackOff" || backOffEvents.length > 0
        ? `Container ${crashLoopContainer.name} is in CrashLoopBackOff.`
        : `Container ${crashLoopContainer.name} has terminated unexpectedly.`;

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