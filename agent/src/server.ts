import express from "express";
import { troubleshootPod } from "./agent.js";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

app.use(express.json({ limit: "16kb" }));

// Health check: confirms that the HTTP server is running.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "k8s-ai-agent",
  });
});

// Run a diagnostic for the requested pod.
app.post("/api/diagnose", async (req, res) => {
  const body: unknown = req.body;

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    res.status(400).json({
      error: "Request body must be a JSON object.",
    });
    return;
  }

  const payload = body as Record<string, unknown>;

  const namespace = payload.namespace;
  const podName = payload.podName;
  const containerName = payload.containerName;

  if (
    typeof namespace !== "string" ||
    namespace.trim().length === 0 ||
    namespace.length > 63
  ) {
    res.status(400).json({
      error: "namespace must be a non-empty string of at most 63 characters.",
    });
    return;
  }

  if (
    typeof podName !== "string" ||
    podName.trim().length === 0 ||
    podName.length > 253
  ) {
    res.status(400).json({
      error: "podName must be a non-empty string of at most 253 characters.",
    });
    return;
  }

  if (
    containerName !== undefined &&
    (
      typeof containerName !== "string" ||
      containerName.trim().length === 0 ||
      containerName.length > 253
    )
  ) {
    res.status(400).json({
      error: "containerName must be a non-empty string of at most 253 characters when provided.",
    });
    return;
  }

  try {
    const result = await troubleshootPod({
      namespace: namespace.trim(),
      podName: podName.trim(),
      containerName:
        typeof containerName === "string"
          ? containerName.trim()
          : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    // Keep internal errors in server logs, not API responses.
    console.error("Pod diagnosis request failed:", error);

    res.status(500).json({
      error: "Failed to collect Kubernetes diagnostics.",
    });
  }
});

// Consistent response for unknown endpoints.
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found.",
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Kubernetes AI Agent API listening on port ${port}`);
});