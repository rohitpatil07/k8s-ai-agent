import { coreApi } from "./client.js";
import type { PodDetail } from "./types.js";

export async function getPod(
  namespace: string,
  podName: string,
): Promise<PodDetail> {
  const pod = await coreApi.readNamespacedPod({
    namespace,
    name: podName,
  });

  const containers: PodDetail["containers"] = (
    pod.spec?.containers ?? []
  ).map(container => {
    const status = pod.status?.containerStatuses?.find(
      status => status.name === container.name,
    );

    const state = status?.state;

    let containerState: NonNullable<
      PodDetail["containers"][number]["state"]
    > = {
      type: "waiting",
    };

    if (state?.running) {
      containerState = {
        type: "running",
        startedAt: state.running.startedAt,
      };
    } else if (state?.waiting) {
      containerState = {
        type: "waiting",
        reason: state.waiting.reason,
        message: state.waiting.message,
      };
    } else if (state?.terminated) {
      containerState = {
        type: "terminated",
        reason: state.terminated.reason,
        message: state.terminated.message,
        exitCode: state.terminated.exitCode,
        signal: state.terminated.signal,
        startedAt: state.terminated.startedAt,
        finishedAt: state.terminated.finishedAt,
      };
    }

    let lastState: PodDetail["containers"][number]["lastState"];

    if (status?.lastState?.terminated) {
      const terminated = status.lastState.terminated;

      lastState = {
        type: "terminated",
        reason: terminated.reason,
        message: terminated.message,
        exitCode: terminated.exitCode,
        signal: terminated.signal,
        startedAt: terminated.startedAt,
        finishedAt: terminated.finishedAt,
      };
    }

    return {
      name: container.name,
      image: container.image,
      ready: status?.ready ?? false,
      restartCount: status?.restartCount ?? 0,
      state: containerState,
      lastState,
    };
  });

  return {
    name: pod.metadata?.name ?? podName,
    namespace: pod.metadata?.namespace ?? namespace,
    phase: pod.status?.phase,
    node: pod.spec?.nodeName,
    podIP: pod.status?.podIP,
    containers,
  };
}