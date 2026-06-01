import {
  MultiAgentStateAnnotation,
  loadGymAppContext,
  createAnthropicClient,
} from "../multi-agent.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = createAnthropicClient();
const context = loadGymAppContext();

export async function testerNode(
  state: typeof MultiAgentStateAnnotation.State
) {
  const { generatedCode, codeType, requirement } = state;

  if (!generatedCode) {
    return {
      ...state,
      testCode: "",
      testCoverage: [],
      testerReasoning: "No code to test",
    };
  }

  const systemPrompt = `You are a test writer for GymApp using Vitest. Your job is to generate comprehensive test cases.

TEST FRAMEWORK CONTEXT:
- Framework: Vitest with environment: 'node'
- Pattern: Extract pure functions from code, test logic without DB mocking
- Reference pattern from test/plans.test.ts

EXAMPLE TEST PATTERNS:
${context.testExample}

TEST COVERAGE REQUIREMENTS:
1. Happy path - function works as expected
2. Validation failures - input validation catches errors
3. Auth failures - unauthorized/forbidden access blocked
4. Edge cases - null values, boundaries, special cases
5. Error scenarios - Supabase errors handled gracefully

TEST WRITING RULES:
1. Extract pure functions from generated code for testing
2. NO database mocking - test business logic independently
3. Use describe() blocks for test scenarios
4. Use it() for individual test cases
5. Use expect() for assertions
6. Include setup/teardown with beforeEach/afterEach if needed
7. Spanish test descriptions matching GymApp conventions
8. Keep tests concise and focused

RESPOND IN JSON FORMAT:
{
  "tests": "full vitest test code",
  "coverage": ["happy path", "validation", "auth", "edge cases"],
  "reasoning": "brief explanation of test strategy"
}`;

  const userPrompt = `Generate comprehensive Vitest tests for this ${codeType}:

\`\`\`typescript
${generatedCode}
\`\`\`

Requirement: ${requirement}

Return JSON with "tests", "coverage", and "reasoning" fields.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content =
      typeof response.content === "string"
        ? response.content
        : response.content.toString();

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse tester response");
    }

    const testResult = JSON.parse(jsonMatch[0]);

    return {
      ...state,
      testCode: testResult.tests || "",
      testCoverage: testResult.coverage || [],
      testerReasoning: testResult.reasoning || "Tests generated",
      status: "tested" as const,
    };
  } catch (err) {
    const errorMsg = `Tester failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ...state,
      testCode: "",
      testCoverage: [],
      errors: [...state.errors, errorMsg],
      testerReasoning: errorMsg,
    };
  }
}
