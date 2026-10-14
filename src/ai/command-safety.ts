const ALLOWED_COMMANDS = new Set([
  "get",
  "describe",
  "logs",
  "top",
]);

const ALLOWED_RESOURCES = new Set([
  "pods",
  "pod",
  "events",
  "services",
  "service",
  "deployments",
  "deployment",
  "nodes",
  "namespaces",
  "namespace",
]);

const BLOCKED_PATTERNS = [
  /;/,
  /&&/,
  /\|\|/,
  /\|/,
  /`/,
  /\$\(/,
  />/,
  /</,
  /\brm\b/i,
  /\bsudo\b/i,
  /\bdelete\b/i,
  /\bapply\b/i,
  /\bpatch\b/i,
  /\bedit\b/i,
  /\bscale\b/i,
  /\bexec\b/i,
  /\battach\b/i,
  /\bport-forward\b/i,
  /\n/,
  /\r/,
  /\$\{/,
  /&/,
  /\\/
];

export function validateDiagnosticCommand(
  command: string,
): { safe: boolean; reason: string } {
  const trimmed = command.trim();

  if (!trimmed) {
    return {
      safe: false,
      reason: "Command is empty.",
    };
  }

  if (BLOCKED_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return {
      safe: false,
      reason: "Command contains a blocked operation or shell syntax.",
    };
  }

  const parts = trimmed.split(/\s+/);

  if (parts[0] !== "kubectl" || !parts[1]) {
    return {
      safe: false,
      reason: "Only approved kubectl diagnostic commands are allowed.",
    };
  }

  if (!ALLOWED_COMMANDS.has(parts[1])) {
    return {
      safe: false,
      reason: `kubectl ${parts[1]} is not in the diagnostic allowlist.`,
    };
  }

  if (parts[1] === "get" || parts[1] === "describe" || parts[1] === "top" || parts[1] === "logs") {
    const resource = parts[2];

    if (!resource || !ALLOWED_RESOURCES.has(resource)) {
        return {
            safe: false,
            reason: "Resource type is missing or not in the diagnostic allowlist.",
            };
        }
    }

  return {
    safe: true,
    reason: "Command passed the basic diagnostic allowlist.",
  };
}