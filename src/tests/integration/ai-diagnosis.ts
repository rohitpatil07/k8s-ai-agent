import { askAI, parseAIAnalysis } from "../../ai/openrouter.js";
import { buildDiagnosisPrompt } from "../../ai/prompts.js";
import { validateDiagnosticCommand } from "../../ai/command-safety.js";
import { CollectedEvidence } from "../../ai/types.js";
import { Scenario }  from "../types.js" 

const scenarios: Scenario[] = [
  {
    name: "Healthy pod",
    evidence: {
      pod: {
        name: "healthy-test",
        namespace: "default",
        phase: "Running",
        containers: [{
          name: "nginx",
          image: "nginx:latest",
          ready: true,
          restartCount: 0,
          state: { type: "running" },
        }],
      },
      events: [],
      logs: { logs: "nginx started successfully" },
    },
    expected: [/running|healthy|no failure/i, /ready/i],
  },
  {
    name: "Scheduling failure",
    evidence: {
      pod: {
        name: "unschedulable-test",
        namespace: "default",
        phase: "Pending",
        containers: [{
          name: "app",
          image: "nginx:latest",
          ready: false,
          restartCount: 0,
          state: {
            type: "waiting",
            reason: "ContainerCreating",
          },
        }],
      },
      events: [{
        type: "Warning",
        reason: "FailedScheduling",
        message: "0/1 nodes are available: insufficient cpu.",
        count: 3,
        component: "default-scheduler",
      }],
      logs: { logs: null },
    },
    expected: [/cpu/i, /schedul|pending/i],
  },
  {
    name: "CrashLoopBackOff",
    evidence: {
      pod: {
        name: "crashloop-test",
        namespace: "default",
        phase: "Running",
        containers: [{
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
        }],
      },
      events: [{
        type: "Warning",
        reason: "BackOff",
        message: "Back-off restarting failed container app",
        count: 5,
        component: "kubelet",
      }],
      logs: {
        logs: "Error: database connection refused\nApplication exiting",
      },
    },
    expected: [
      /crashloopbackoff|restart|crash/i,
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
        containers: [{
          name: "worker",
          image: "busybox:latest",
          ready: false,
          restartCount: 0,
          state: {
            type: "terminated",
            reason: "Completed",
            exitCode: 0,
          },
        }],
      },
      events: [],
      logs: { logs: "Job finished successfully" },
    },
    expected: [/completed|success|exit code 0/i],
  },
];

async function main() {
  let failures = 0;

  for (const scenario of scenarios) {
    console.log(`\n===== ${scenario.name} =====`);

    try {
      const prompt = buildDiagnosisPrompt(
        scenario.evidence.pod.name,
        scenario.evidence.pod.namespace,
        scenario.evidence,
      );

      const rawResponse = await askAI(prompt);
      const analysis = parseAIAnalysis(rawResponse);

      console.log("Assessment:", analysis.assessment);
      console.log("Likely cause:", analysis.likelyCause);
      console.log("Confidence:", analysis.confidence);

      const output = JSON.stringify(analysis);
      const missingExpectations = scenario.expected.filter(
        pattern => !pattern.test(output),
      );

      if (missingExpectations.length > 0) {
        failures++;
        console.log("RESULT: REVIEW — expected diagnostic signals were missing.");
        console.log(
          "Missing patterns:",
          missingExpectations.map(pattern => pattern.toString()),
        );
      } else {
        console.log("RESULT: PASS — expected diagnostic signals found.");
      }

      console.log("Suggested commands:");

      for (const check of analysis.nextChecks) {
        const validation = validateDiagnosticCommand(check.command);

        console.log(
          `  [${validation.safe ? "ALLOWED" : "BLOCKED"}] ${check.command}`,
        );
        console.log(`    Reason: ${check.reason}`);

        if (!validation.safe) {
          console.log(`    Validator: ${validation.reason}`);
        }
      }
    } catch (error) {
      failures++;
      console.error("RESULT: FAIL — AI request or response validation failed.");
      console.error(error);
    }
  }

  console.log(`\nFinished: ${scenarios.length} scenarios, ${failures} requiring review.`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error("Test suite failed:", error);
  process.exitCode = 1;
});