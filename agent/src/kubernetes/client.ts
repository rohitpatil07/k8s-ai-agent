import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

// const activeCluster = kc.getCurrentCluster();

// console.log("[Kubernetes client configuration]", {
//   cwd: process.cwd(),
//   kubeconfigPath: process.env.KUBECONFIG ?? "(default kubeconfig lookup)",
//   context: kc.getCurrentContext(),
//   server: activeCluster?.server,
//   skipTLSVerify: activeCluster?.skipTLSVerify ?? false,
// });

export const coreApi = kc.makeApiClient(k8s.CoreV1Api);