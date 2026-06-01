import { Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { readFileSync } from "fs";
import { join } from "path";

// ==================== STATE SCHEMA ====================

export const MultiAgentStateAnnotation = Annotation.Root({
  // Input
  requirement: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),
  codeType: Annotation<"server-action" | "api-route" | "hook" | "component">({
    reducer: (x) => x,
    default: () => "server-action",
  }),
  context: Annotation<{
    studentId?: string;
    dataModel?: string;
    existingCode?: string;
  }>({
    reducer: (x) => x,
    default: () => ({}),
  }),

  // Processing - Generator
  generatedCode: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),
  generatorReasoning: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),

  // Processing - Reviewer
  reviewIssues: Annotation<
    Array<{
      severity: "error" | "warning" | "info";
      message: string;
      location?: string;
    }>
  >({
    reducer: (x) => x,
    default: () => [],
  }),
  reviewApproved: Annotation<boolean>({
    reducer: (x) => x,
    default: () => false,
  }),
  reviewReasoning: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),

  // Processing - Tester
  testCode: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),
  testCoverage: Annotation<string[]>({
    reducer: (x) => x,
    default: () => [],
  }),
  testerReasoning: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),

  // Processing - Optimizer
  optimizations: Annotation<
    Array<{
      type: "duplication" | "performance" | "readability";
      suggestion: string;
      appliedFix?: string;
    }>
  >({
    reducer: (x) => x,
    default: () => [],
  }),
  optimizedCode: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),
  optimizerReasoning: Annotation<string>({
    reducer: (x) => x,
    default: () => "",
  }),

  // Meta
  revisionCount: Annotation<number>({
    reducer: (x) => x,
    default: () => 0,
  }),
  status: Annotation<
    "pending" | "generated" | "reviewed" | "tested" | "optimized" | "complete"
  >({
    reducer: (x) => x,
    default: () => "pending",
  }),
  errors: Annotation<string[]>({
    reducer: (x) => x,
    default: () => [],
  }),
});

// ==================== CONTEXT LOADERS ====================

let cachedContext: {
  claudeMd: string;
  supabaseTypes: string;
  serverActionExample: string;
  apiRouteExample: string;
  hookExample: string;
  testExample: string;
} | null = null;

export function loadGymAppContext() {
  if (cachedContext) return cachedContext;

  const projectRoot = process.cwd();

  try {
    const claudeMd = readFileSync(
      join(projectRoot, "CLAUDE.md"),
      "utf-8"
    );

    const supabaseTypes = readFileSync(
      join(projectRoot, "src/types/supabase.ts"),
      "utf-8"
    ).substring(0, 2000); // First 2000 chars for context

    const serverActionExample = readFileSync(
      join(
        projectRoot,
        "src/app/(dashboard)/coach/student/actions.ts"
      ),
      "utf-8"
    ).substring(0, 3000); // First 3000 chars

    const apiRouteExample = readFileSync(
      join(projectRoot, "src/app/api/templates/route.ts"),
      "utf-8"
    );

    const hookExample = readFileSync(
      join(projectRoot, "src/hooks/useTemplates.ts"),
      "utf-8"
    );

    const testExample = readFileSync(
      join(projectRoot, "test/plans.test.ts"),
      "utf-8"
    ).substring(0, 2000); // First 2000 chars

    cachedContext = {
      claudeMd,
      supabaseTypes,
      serverActionExample,
      apiRouteExample,
      hookExample,
      testExample,
    };

    return cachedContext;
  } catch (err) {
    console.error(
      "Error loading GymApp context:",
      err instanceof Error ? err.message : err
    );
    return {
      claudeMd: "",
      supabaseTypes: "",
      serverActionExample: "",
      apiRouteExample: "",
      hookExample: "",
      testExample: "",
    };
  }
}

// ==================== LLM CLIENT ====================

export function createAnthropicClient() {
  return new ChatAnthropic({
    modelName: "claude-opus-4-7",
    temperature: 0,
    maxTokens: 4096,
  });
}
