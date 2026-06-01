import {
  MultiAgentStateAnnotation,
  loadGymAppContext,
  createAnthropicClient,
} from "../multi-agent.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = createAnthropicClient();
const context = loadGymAppContext();

export async function generatorNode(
  state: typeof MultiAgentStateAnnotation.State
) {
  const { requirement, codeType, context: userContext } = state;

  // Select examples based on code type
  let example = "";
  switch (codeType) {
    case "server-action":
      example = context.serverActionExample;
      break;
    case "api-route":
      example = context.apiRouteExample;
      break;
    case "hook":
      example = context.hookExample;
      break;
    case "component":
      example = context.apiRouteExample; // Use API route as fallback
      break;
  }

  const systemPrompt = `You are a code generator for GymApp, a Next.js 16 gym coaching application.

PROJECT CONTEXT (from CLAUDE.md):
${context.claudeMd}

TYPE DEFINITIONS:
${context.supabaseTypes}

REFERENCE CODE EXAMPLE:
${example}

YOUR TASK:
Generate TypeScript code for the following requirement:
${requirement}

CODE TYPE: ${codeType}
${userContext.dataModel ? `DATA MODEL: ${userContext.dataModel}` : ""}
${userContext.studentId ? `STUDENT ID CONTEXT: ${userContext.studentId}` : ""}
${userContext.existingCode ? `EXISTING CODE TO REFERENCE:\n${userContext.existingCode}` : ""}

RULES YOU MUST FOLLOW:
1. Follow GymApp naming conventions and patterns strictly
2. Use correct Supabase client:
   - createSupabaseBrowserClient() for client components & hooks
   - createSupabaseServerClient() for Server Components & Server Actions
   - createSupabaseAdminClient() for privileged operations (service-role)
3. Include auth checks and role verification (ADMIN, COACH, STUDENT)
4. For mutations: add revalidatePath() after database writes
5. Error handling: use custom prefixes like "PLAN_COLLISION:", "AUTH_REQUIRED:"
6. Extract pure functions for testability (separate logic from DB calls)
7. Type all values - NO implicit any types
8. Include "use server" at top for Server Actions
9. Comments only for non-obvious logic or workarounds
10. Spanish text in UI components
11. All dates in ISO format (YYYY-MM-DD)
12. Keep code under 200 lines

OUTPUT FORMAT:
- Full, working TypeScript code
- Include import statements
- Include JSDoc-style type annotations where helpful
- NO explanations, just the code`;

  const userPrompt = `Generate the code now. Only output the code, no preamble.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const generatedCode =
      typeof response.content === "string"
        ? response.content
        : response.content.toString();

    return {
      ...state,
      generatedCode,
      generatorReasoning: `Generated ${codeType} for requirement: ${requirement.substring(0, 50)}...`,
      status: "generated" as const,
    };
  } catch (err) {
    const errorMsg = `Generator failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ...state,
      errors: [...state.errors, errorMsg],
      status: "pending" as const,
    };
  }
}
