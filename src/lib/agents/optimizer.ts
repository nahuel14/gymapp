import {
  MultiAgentStateAnnotation,
  createAnthropicClient,
} from "../multi-agent.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = createAnthropicClient();

export async function optimizerNode(
  state: typeof MultiAgentStateAnnotation.State
) {
  const { generatedCode, codeType, requirement } = state;

  if (!generatedCode) {
    return {
      ...state,
      optimizedCode: "",
      optimizations: [],
      optimizerReasoning: "No code to optimize",
      status: "optimized" as const,
    };
  }

  const systemPrompt = `You are a code optimization expert for GymApp. Your job is to identify and suggest improvements.

OPTIMIZATION PRIORITIES:
1. Duplication - Is similar logic repeated? Can it be extracted to a helper?
2. Performance - Are there N+1 queries? Unnecessary loops? Inefficient algorithms?
3. Readability - Can variable names be clearer? Can logic be simplified?

OPTIMIZATION RULES:
1. Do NOT refactor for hypothetical future use
2. Only optimize if it provides measurable benefit
3. Extract helpers only if logic is repeated 3+ times
4. Keep changes minimal and focused
5. Maintain original functionality exactly

RESPOND IN JSON FORMAT:
{
  "hasOptimizations": boolean,
  "optimizations": [
    {
      "type": "duplication" | "performance" | "readability",
      "suggestion": "what to optimize and why",
      "appliedFix": "the refactored code snippet (if significant)" or null
    }
  ],
  "optimizedCode": "the improved code or original if minimal changes",
  "reasoning": "brief summary of optimizations applied"
}`;

  const userPrompt = `Analyze this ${codeType} for optimization opportunities:

\`\`\`typescript
${generatedCode}
\`\`\`

Requirement: ${requirement}

Identify duplication, performance issues, and readability improvements.
Only apply optimizations if they provide clear benefits.
Return JSON response.`;

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
      throw new Error("Could not parse optimizer response");
    }

    const optimizeResult = JSON.parse(jsonMatch[0]);

    return {
      ...state,
      optimizations: optimizeResult.optimizations || [],
      optimizedCode: optimizeResult.optimizedCode || generatedCode,
      optimizerReasoning: optimizeResult.reasoning || "No optimizations needed",
      status: "optimized" as const,
    };
  } catch (err) {
    const errorMsg = `Optimizer failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ...state,
      optimizations: [],
      optimizedCode: generatedCode,
      errors: [...state.errors, errorMsg],
      optimizerReasoning: errorMsg,
      status: "optimized" as const,
    };
  }
}
