import type {
  DiagnosticContext,
  Diagnosis,
} from "./kubernetes/types.js";

export function diagnose(
  context: DiagnosticContext,
): Diagnosis {
  const { pod, events, logs } = context;

  const evidence: string[] = [];

  // Add unhealthy container evidence.
  for (const container of pod.containers) {
    if (
      container.state?.reason ||
      container.state?.type === "terminated"
    ) {
      evidence.push(
        `Container ${container.name}: ` +
        `state=${container.state?.type ?? "unknown"}, ` +
        `reason=${container.state?.reason ?? "unknown"}, ` +
        `restartCount=${container.restartCount}.`,
      );
    }
  }

  // Add relevant Kubernetes events.
  for (const event of events) {
    if (
      event.type === "Warning" ||
      event.reason === "BackOff"
    ) {
      evidence.push(
        `Kubernetes event: ${event.message}`,
      );
    }
  }

  // Add previous logs when available.
  if (logs.logs) {
    evidence.push(
      `Container logs:\n${logs.logs.trim()}`,
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

  // --------------------------------------------------
  // CrashLoopBackOff
  // --------------------------------------------------

  const crashLoopContainer = pod.containers.find(
    container =>
      container.state?.reason === "CrashLoopBackOff",
  );

  if (crashLoopContainer) {
    summary =
      `Container ${crashLoopContainer.name} is in CrashLoopBackOff.`;

    rootCause =
      `The ${crashLoopContainer.name} container is repeatedly ` +
      `crashing and Kubernetes is restarting it.`;

    recommendation =
      "Inspect the previous container logs and termination details " +
      "to determine why the application is crashing.";
  }

  // --------------------------------------------------
  // ErrImagePull / ImagePullBackOff
  // --------------------------------------------------

  const imagePullContainer = pod.containers.find(
    container =>
      container.state?.reason === "ErrImagePull" ||
      container.state?.reason === "ImagePullBackOff",
  );

  if (imagePullContainer) {
    summary =
      `Container ${imagePullContainer.name} cannot start because its image cannot be pulled.`;

    const imageError = events.find(
      event =>
        event.reason === "Failed" &&
        event.message.toLowerCase().includes("pull image"),
    );

    if (imageError) {
      rootCause =
        `The container image could not be pulled. ` +
        `${imageError.message}`;
    } else {
      rootCause =
        `The ${imagePullContainer.name} container is unable to pull its image.`;
    }

    recommendation =
      "Verify the image name, tag, registry, and registry credentials.";
  }


  // --------------------------------------------------
  // OOMKilled
  // --------------------------------------------------

  const oomContainer = pod.containers.find(
    container =>
      container.state?.reason === "OOMKilled",
  );

  if (oomContainer) {
    summary =
      `Container ${oomContainer.name} was killed because it exceeded its memory limit.`;

    rootCause =
      `The ${oomContainer.name} container was terminated by Kubernetes ` +
      `due to an out-of-memory condition.`;

    recommendation =
      "Check the container memory limit and memory usage. " +
      "Increase the memory limit or reduce the application's memory consumption.";
  }

  const schedulingEvent = events.find(
    event => event.reason === "FailedScheduling",
  );

  // --------------------------------------------------
  // Scheduling Error
  // --------------------------------------------------

  if (schedulingEvent) {
    summary = `Pod ${pod.name} is pending because it cannot be scheduled.`;

    rootCause =
      `The pod cannot be scheduled because the available nodes ` +
      `do not have sufficient resources.`;

    recommendation =
      "Check node resource capacity and the pod's resource requests. " +
      "Reduce the resource request or add/scale nodes.";
  }

  // --------------------------------------------------
  // Failed Container
  // --------------------------------------------------

  const failedContainer = pod.containers.find(
    container =>
      container.state?.type === "terminated" &&
      container.state.reason === "Error" &&
      (container.state.exitCode ?? 0) !== 0,
  );

  if (failedContainer) {
    summary =
      `Container ${failedContainer.name} terminated with an error.`;

    rootCause =
      `The ${failedContainer.name} container exited with a non-zero ` +
      `exit code (${failedContainer.state?.exitCode}). ` +
      `This indicates that the application terminated unsuccessfully.`;

    recommendation =
      "Inspect the container logs and application error output " +
      "to determine why the process exited.";
  }

  // --------------------------------------------------
  // Unbound PVC
  // --------------------------------------------------
  const pvcSchedulingEvent = events.find(
    event =>
      event.reason === "FailedScheduling" &&
      event.message
        .toLowerCase()
        .includes("unbound immediate persistentvolumeclaims"),
  );

  if (pvcSchedulingEvent) {
    summary =
      `Pod ${pod.name} cannot be scheduled because its ` +
      `PersistentVolumeClaim is not bound.`;

    rootCause =
      "The pod references a PersistentVolumeClaim that is not bound " +
      "to a PersistentVolume.";

    recommendation =
      "Check the PVC status, storageClass, available PersistentVolumes, " +
      "and storage provisioner configuration.";
  }

  return {
    summary,
    rootCause,
    evidence,
    recommendation,
  };
}