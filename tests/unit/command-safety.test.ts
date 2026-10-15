
import { describe, expect, it } from "vitest";
import { validateDiagnosticCommand } from "../../src/ai/command-safety.js";

describe("validateDiagnosticCommand", () => {
  describe("approved diagnostic commands", () => {
    it.each([
      "kubectl get pods",
      "kubectl describe pod nginx -n default",
      "kubectl top nodes",
      "kubectl logs crashloop-test -n default --previous",
      "kubectl get pods -o wide",
    ])("allows: %s", (command) => {
      expect(validateDiagnosticCommand(command).safe).toBe(true);
    });
  });

  describe("dangerous commands and shell syntax", () => {
    it.each([
      "kubectl delete pod nginx",
      "kubectl get pods; kubectl delete pod nginx",
      "kubectl get pods --raw=/api/v1/secrets",
      "kubectl get pods --as system:admin",
      "kubectl get pods --token example-token",
      "kubectl get pods --server https://example.invalid",
      "kubectl get pods --watch",
      "kubectl exec nginx -- sh",
    ])("blocks: %s", (command) => {
      expect(validateDiagnosticCommand(command).safe).toBe(false);
    });
  });

  describe("invalid or incomplete commands", () => {
    it.each([
      "",
      "kubectl",
      "kubectl delete",
      "kubectl logs",
      "kubectl get pods --invented-flag",
    ])("rejects: %s", (command) => {
      expect(validateDiagnosticCommand(command).safe).toBe(false);
    });
  });
});
