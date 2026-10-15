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


const ALLOWED_FLAGS: Record<string, Set<string>> = {
  get: new Set([
    "-n", "--namespace",
    "-o", "--output",
    "-l", "--selector",
    "--show-labels",
    "--sort-by",
    "--field-selector",
  ]),
  describe: new Set([
    "-n", "--namespace",
  ]),
  logs: new Set([
    "-n", "--namespace",
    "-c", "--container",
    "--previous", "-p",
    "--tail",
    "--since",
    "--timestamps",
    "--all-containers",
    "--prefix",
  ]),
  top: new Set([
    "-n", "--namespace",
  ]),
};

const FLAGS_WITH_VALUES = new Set([
  "-n", "--namespace",
  "-o", "--output",
  "-l", "--selector",
  "--sort-by",
  "--field-selector",
  "-c", "--container",
  "--tail",
  "--since",
]);

const ALLOWED_OUTPUT_FORMATS = new Set([
  "wide",
  "json",
  "yaml",
  "name",
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
  /\\/,
  /--raw(?:=|\s|$)/i,
  /--follow\b/i,
  /--watch(?:=|\s|$)/i,
  /-w\b/,
  /--as(?:=|\s|$)/i,
  /--as-group(?:=|\s|$)/i,
  /--token(?:=|\s|$)/i,
  /--server(?:=|\s|$)/i,
  /--kubeconfig(?:=|\s|$)/i,
  /--context(?:=|\s|$)/i,
  /--certificate-authority(?:=|\s|$)/i,
  /--client-certificate(?:=|\s|$)/i,
  /--client-key(?:=|\s|$)/i,
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

  if (parts[1] === "get" || parts[1] === "describe" || parts[1] === "top" ) {
    const resource = parts[2];

    if (!resource || !ALLOWED_RESOURCES.has(resource)) {
        return {
            safe: false,
            reason: "Resource type is missing or not in the diagnostic allowlist.",
        };
    }
  }

  if (parts[1] === "logs" && !parts[2]) {
    return {
        safe: false,
        reason: "kubectl logs requires a pod name.",
    };
  }

  
  const allowedFlags = ALLOWED_FLAGS[parts[1]];

  for (let i = 2; i < parts.length; i++) {
    const token = parts[i];

    if (!token.startsWith("-")) {
      continue;
    }

    const equalsIndex = token.indexOf("=");
    const flag =
      equalsIndex >= 0
        ? token.slice(0, equalsIndex)
        : token;

    if (!allowedFlags.has(flag)) {
      return {
        safe: false,
        reason: `Flag ${flag} is not allowed for kubectl ${parts[1]}.`,
      };
    }

    if (FLAGS_WITH_VALUES.has(flag)) {
      const inlineValue =
        equalsIndex >= 0
          ? token.slice(equalsIndex + 1)
          : undefined;

      const value = inlineValue ?? parts[i + 1];

      if (!value || value.startsWith("-")) {
        return {
          safe: false,
          reason: `Flag ${flag} requires a valid value.`,
        };
      }

      if (equalsIndex < 0) {
        i++;
      }

      if (
        (flag === "-o" || flag === "--output") &&
        !ALLOWED_OUTPUT_FORMATS.has(value)
      ) {
        return {
          safe: false,
          reason: `Output format ${value} is not allowed.`,
        };
      }

      if (
        flag === "--tail" &&
        !/^\d{1,5}$/.test(value)
      ) {
        return {
          safe: false,
          reason: "The --tail value must be a non-negative integer.",
        };
      }

      if (
        flag === "--since" &&
        !/^\d+[smhd]$/.test(value)
      ) {
        return {
          safe: false,
          reason: "The --since value must be a duration such as 10m or 1h.",
        };
      }
    } else if (equalsIndex >= 0) {
      return {
        safe: false,
        reason: `Flag ${flag} does not accept an inline value.`,
      };
    }
  }


  return {
    safe: true,
    reason: "Command passed the basic diagnostic allowlist.",
  };
}