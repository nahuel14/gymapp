import { StateGraph, START, END } from "@langchain/langgraph";
import { MultiAgentStateAnnotation } from "./multi-agent.js";
import { generatorNode } from "./agents/generator.js";
import { reviewerNode } from "./agents/reviewer.js";
import { testerNode } from "./agents/tester.js";
import { optimizerNode } from "./agents/optimizer.js";

// ==================== NODES ====================

async function orchestratorNode(
  state: typeof MultiAgentStateAnnotation.State
) {
  // Initial setup - just pass through to generator
  return {
    ...state,
    status: "pending" as const,
  };
}

async function revisionNode(
  state: typeof MultiAgentStateAnnotation.State
) {
  // Prepare feedback for generator to fix issues
  const feedback = state.reviewIssues
    .map((issue) => `[${issue.severity.toUpperCase()}] ${issue.message}`)
    .join("\n");

  const requirement = `PREVIOUS REQUIREMENT: ${state.requirement}

REVIEWER FEEDBACK - FIX THESE ISSUES:
${feedback}

${state.revisionCount >= 2 ? "This is the final revision attempt. Make your best effort to address all issues." : ""}`;

  return {
    ...state,
    requirement,
    revisionCount: state.revisionCount + 1,
  };
}

// ==================== CONDITIONAL EDGES ====================

function shouldRevise(state: typeof MultiAgentStateAnnotation.State) {
  // If reviewer found errors and we haven't exceeded max revisions
  if (!state.reviewApproved && state.revisionCount < 3) {
    return "revise";
  }
  // Otherwise proceed to testing
  return "test";
}

// ==================== BUILD GRAPH ====================

export function buildMultiAgentGraph() {
  const graph = new StateGraph(MultiAgentStateAnnotation)
    // Add nodes
    .addNode("orchestrator", orchestratorNode)
    .addNode("generator", generatorNode)
    .addNode("reviewer", reviewerNode)
    .addNode("revision", revisionNode)
    .addNode("tester", testerNode)
    .addNode("optimizer", optimizerNode)

    // Define edges
    .addEdge(START, "orchestrator")
    .addEdge("orchestrator", "generator")
    .addEdge("generator", "reviewer")
    .addConditionalEdges("reviewer", shouldRevise, {
      revise: "revision",
      test: "tester",
    })
    .addEdge("revision", "generator")
    .addEdge("tester", "optimizer")
    .addEdge("optimizer", END);

  return graph.compile();
}

// ==================== EXECUTION HELPERS ====================

export async function runMultiAgentFlow(input: {
  requirement: string;
  codeType: "server-action" | "api-route" | "hook" | "component";
  context?: {
    studentId?: string;
    dataModel?: string;
    existingCode?: string;
  };
}) {
  const graph = buildMultiAgentGraph();

  const initialState = {
    requirement: input.requirement,
    codeType: input.codeType,
    context: input.context || {},
    generatedCode: "",
    generatorReasoning: "",
    reviewIssues: [],
    reviewApproved: false,
    reviewReasoning: "",
    testCode: "",
    testCoverage: [],
    testerReasoning: "",
    optimizations: [],
    optimizedCode: "",
    optimizerReasoning: "",
    revisionCount: 0,
    status: "pending" as const,
    errors: [],
  };

  try {
    const result = await graph.invoke(initialState);
    return result;
  } catch (err) {
    throw new Error(
      `Multi-agent flow failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ==================== SUMMARY FORMATTER ====================

export function formatSummary(result: typeof MultiAgentStateAnnotation.State) {
  const output: string[] = [];

  output.push("═".repeat(60));
  output.push("📊 MULTI-AGENT CODE GENERATION SUMMARY");
  output.push("═".repeat(60));
  output.push("");

  // Status
  output.push(`Status: ${result.status.toUpperCase()}`);
  if (result.errors.length > 0) {
    output.push(`Errors: ${result.errors.length}`);
    result.errors.forEach((err) => output.push(`  ⚠️ ${err}`));
  }
  output.push("");

  // Code Generation
  output.push("1️⃣  CODE GENERATION");
  output.push(`   ${result.generatorReasoning}`);
  output.push(`   Lines: ${result.generatedCode.split("\n").length}`);
  output.push("");

  // Review
  output.push("2️⃣  CODE REVIEW");
  if (result.reviewApproved) {
    output.push("   ✅ Approved - No issues found");
  } else {
    output.push(
      `   ⚠️  Found ${result.reviewIssues.length} issue(s):`
    );
    result.reviewIssues.forEach((issue) => {
      const icon =
        issue.severity === "error"
          ? "❌"
          : issue.severity === "warning"
            ? "⚠️ "
            : "ℹ️ ";
      output.push(
        `      ${icon} [${issue.severity}] ${issue.message}`
      );
    });
    output.push(`   Revisions: ${result.revisionCount}`);
  }
  output.push("");

  // Testing
  if (result.testCode) {
    output.push("3️⃣  TESTS GENERATED");
    output.push(
      `   Coverage: ${result.testCoverage.join(", ")}`
    );
    output.push(`   Test lines: ${result.testCode.split("\n").length}`);
    output.push("");
  }

  // Optimization
  if (result.optimizations.length > 0) {
    output.push("4️⃣  OPTIMIZATIONS");
    result.optimizations.forEach((opt) => {
      output.push(`   💡 [${opt.type}] ${opt.suggestion}`);
    });
    output.push("");
  }

  output.push("═".repeat(60));

  return output.join("\n");
}
