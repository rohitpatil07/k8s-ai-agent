import { askAI } from "./openrouter.js";

try {
  const answer = await askAI(
    "A Kubernetes pod is in CrashLoopBackOff. In two short sentences, explain what this means and suggest one safe diagnostic command."
  );

  console.log("\nAI response:\n");
  console.log(answer);
} catch (error) {
  console.error("AI test failed:", error);
  process.exitCode = 1;
}