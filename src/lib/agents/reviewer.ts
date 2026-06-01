import {
  MultiAgentStateAnnotation,
  createAnthropicClient,
} from "../multi-agent.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = createAnthropicClient();

export async function reviewerNode(
  state: typeof MultiAgentStateAnnotation.State
) {
  const { generatedCode, codeType, requirement, revisionCount } = state;

  if (!generatedCode) {
    return {
      ...state,
      reviewApproved: false,
      reviewIssues: [
        {
          severity: "error",
          message: "No code generated to review",
        },
      ],
    };
  }

  const systemPrompt = `You are a strict code reviewer for GymApp. Your job is to validate generated code against GymApp conventions.

VALIDATION CHECKLIST:
1. ✓ Correct Supabase client usage:
   - Server Actions: createSupabaseServerClient() or createSupabaseAdminClient()
   - Hooks: createSupabaseBrowserClient()
   - API routes: createSupabaseServerClient()

2. ✓ Authentication & Authorization:
   - Auth check present (getUser())
   - Role verification when needed (ADMIN, COACH, STUDENT)
   - Returns 401 for auth failures, 403 for permission failures

3. ✓ Data Mutations:
   - Pre-reads complete before writes (transactional pattern)
   - revalidatePath() called after mutations
   - Error handling present

4. ✓ Type Safety:
   - No implicit any types
   - Uses Database["public"]["Enums"] for enums
   - Uses Tables<"table_name"> for models

5. ✓ Error Handling:
   - Custom error prefixes (e.g., "PLAN_COLLISION:", "AUTH_REQUIRED:")
   - Meaningful error messages

6. ✓ Code Quality:
   - No commented code
   - Comments only for non-obvious logic
   - Spanish text in UI
   - Proper imports

7. ✓ Security:
   - No hardcoded credentials
   - Proper input validation
   - SQL injection prevention (using Supabase client)

RESPOND IN JSON FORMAT:
{
  "approved": boolean,
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "message": "specific issue description",
      "location": "line or section where issue is found"
    }
  ],
  "reasoning": "brief explanation of review"
}`;

  const userPrompt = `Review this ${codeType} code for GymApp:

\`\`\`typescript
${generatedCode}
\`\`\`

Requirement was: ${requirement}

${revisionCount > 0 ? `This is revision attempt ${revisionCount}. Look for improvements on previous issues.` : ""}

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
      throw new Error("Could not parse reviewer response");
    }

    const reviewResult = JSON.parse(jsonMatch[0]);

    const approved =
      reviewResult.approved === true ||
      (reviewResult.issues && reviewResult.issues.length === 0);

    return {
      ...state,
      reviewApproved: approved,
      reviewIssues: reviewResult.issues || [],
      reviewReasoning: reviewResult.reasoning || "Review complete",
      status: approved ? ("reviewed" as const) : ("generated" as const),
    };
  } catch (err) {
    const errorMsg = `Reviewer failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ...state,
      reviewApproved: false,
      errors: [...state.errors, errorMsg],
      reviewIssues: [
        {
          severity: "error",
          message: errorMsg,
        },
      ],
    };
  }
}
