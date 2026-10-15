
import { describe, expect, it } from "vitest";
import { askAI, parseAIAnalysis } from "../../src/ai/openrouter.js";
import { buildDiagnosisPrompt } from "../../src/ai/prompts.js";
import type { CollectedEvidence } from "../../src/ai/types.js";

interface Scenario {
  name: string;
  evidence: CollectedEvidence;
  expected: RegExp[];
  expectedCheck?: boolean;
}

const scenarios: Scenario[] = [
  {
    name: "Healthy pod",
    evidence: {
      pod: {
        name: "healthy-test",
        namespace: "default",
        phase: "Running",
        containers: [
          {
            name: "nginx",
            image: "nginx:latest",
            ready: true,
            restartCount: 0,
            state: { type: "running" },
          },
        ],
      },
      events: [],
      logs: { logs: "nginx started successfully" },
    },
    expected: [
      /healthy|running|no failure/i,
      /ready|container/i,
    ],
  },
  {
    name: "Scheduling failure",
    evidence: {
      pod: {
        name: "unschedulable-test",
        namespace: "default",
        phase: "Pending",
        containers: [
          {
            name: "app",
            image: "nginx:latest",
            ready: false,
            restartCount: 0,
            state: {
              type: "waiting",
              reason: "ContainerCreating",
            },
          },
        ],
      },
      events: [
        {
          type: "Warning",
          reason: "FailedScheduling",
          message: "0/1 nodes are available: insufficient cpu.",
          count: 3,
          component: "default-scheduler",
        },
      ],
      logs: { logs: null },
    },
    expected: [
      /cpu/i,
      /schedul|pending|node/i,
    ],
    expectedCheck: true,
  },
  {
    name: "CrashLoopBackOff",
    evidence: {
      pod: {
        name: "crashloop-test",
        namespace: "default",
        phase: "Running",
        containers: [
          {
            name: "app",
            image: "example/app:latest",
            ready: false,
            restartCount: 5,
            state: {
              type: "waiting",
              reason: "CrashLoopBackOff",
            },
            lastState: {
              type: "terminated",
              reason: "Error",
              exitCode: 1,
            },
          },
        ],
      },
      events: [
        {
          type: "Warning",
          reason: "BackOff",
          message: "Back-off restarting failed container app",
          count: 5,
          component: "kubelet",
        },
      ],
      logs: {
        logs: "Error: database connection refused\nApplication exiting",
      },
    },
    expected: [
      /crashloopbackoff|crash|restart/i,
      /database|connection refused/i,
    ],
  },
  {
    name: "Successful Job",
    evidence: {
      pod: {
        name: "job-completed-test",
        namespace: "default",
        phase: "Succeeded",
        containers: [
          {
            name: "worker",
            image: "busybox:latest",
            ready: false,
            restartCount: 0,
            state: {
              type: "terminated",
              reason: "Completed",
              exitCode: 0,
            },
          },
        ],
      },
      events: [],
      logs: { logs: "Job finished successfully" },
    },
    expected: [
      /completed|success|exit code 0/i,
    ],
  },
];

describe.skipIf(!process.env.OPENROUTER_API_KEY)(
  "AI diagnosis integration",
  () => {
    it.each(scenarios)(
      "$name",
      async ({ scenario }) => {
         const { evidence, expected } = scenario;
        const prompt = buildDiagnosisPrompt(
          evidence.pod.name,
          evidence.pod.namespace,
          evidence,
        );

        const rawResponse = await askAI(prompt);

        let analysis: ReturnType<typeof parseAIAnalysis>;

        try {
          analysis = parseAIAnalysis(rawResponse);
        } catch (error) {
          console.error(
            `Invalid AI response for scenario "${evidence.pod.name}":`,
          );
          console.error(rawResponse);
          throw error;
        }

        // Verify the structured response contains usable results.
        expect(analysis.assessment.trim()).not.toBe("");
        expect(analysis.likelyCause.trim()).not.toBe("");
        expect(["low", "medium", "high"]).toContain(
          analysis.confidence,
        );

        expect(Array.isArray(analysis.supportingEvidence)).toBe(true);
        expect(Array.isArray(analysis.uncertainties)).toBe(true);
        expect(Array.isArray(analysis.nextChecks)).toBe(true);

        // Evaluate diagnostic signals without requiring exact wording.
        const diagnosticText = [
          analysis.assessment,
          analysis.likelyCause,
          ...analysis.supportingEvidence,
        ].join("\n");

        for (const pattern of expected) {
          expect(diagnosticText).toMatch(pattern);
        }

        if (scenario.expectedCheck) {
          const hasUsefulResourceCheck = analysis.nextChecks.some(
            ({ command, reason }) =>
              (
                /kubectl describe pod/i.test(command) &&
                /request|schedul|cpu/i.test(reason)
              ) ||
              (
                /kubectl describe nodes/i.test(command) &&
                /allocatable|capacity|cpu/i.test(reason)
              ) ||
              (
                /kubectl top nodes/i.test(command) &&
                /usage|utilization|metrics/i.test(reason)
              ),
          );

          expect(
            hasUsefulResourceCheck,
            "Expected a command that meaningfully investigates scheduling resources",
          ).toBe(true);
        }

        // Every suggested check should include a command and rationale.
        for (const check of analysis.nextChecks) {
          expect(check.command.trim()).not.toBe("");
          expect(check.reason.trim()).not.toBe("");
        }
      },
      60_000,
    );
  },
);
