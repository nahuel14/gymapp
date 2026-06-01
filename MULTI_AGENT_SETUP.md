# Multi-Agent Code Generation System - Setup

## Configuration

To use the multi-agent system, you need to set up your Anthropic API key:

### 1. Get Your API Key
Visit [Anthropic Console](https://console.anthropic.com) and create an API key.

### 2. Set Environment Variable

**Option A: For Development**
```bash
# Create a .env.local file in project root
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
```

**Option B: System Environment**
```bash
# macOS/Linux
export ANTHROPIC_API_KEY=sk-ant-...

# Windows PowerShell
$env:ANTHROPIC_API_KEY='sk-ant-...'
```

### 3. Usage

Once configured, run the multi-agent system:

```bash
# Generate a Server Action
npm run generate -- \
  --type server-action \
  --requirement "Create Server Action to duplicate a training plan" \
  --context '{"dataModel": "training_plan"}'

# Generate an API Route
npm run generate -- \
  --type api-route \
  --requirement "Create API endpoint to fetch coach students" \
  --output

# Generate a React Query Hook
npm run generate -- \
  --type hook \
  --requirement "Create hook to fetch training plans for a student"

# Generate a Component
npm run generate -- \
  --type component \
  --requirement "Create dialog to assign exercises to a session"
```

### 4. Output

The system will:
1. ✅ Generate code following GymApp patterns
2. ✅ Review against project conventions
3. ✅ Generate comprehensive Vitest tests
4. ✅ Optimize for performance/readability
5. 📊 Display summary with reasoning

### 5. Generated Files

If `--output` is specified:
- Code: `src/lib/generated/generated-[type]-[date].ts`
- Tests: `test/generated-[type].test.ts`

## System Architecture

```
CLI Input
  ↓
┌─────────────────────────────────────────┐
│ 1. Code Generator                       │ ← Generates TypeScript code
│    Following GymApp patterns            │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 2. Code Reviewer                        │ ← Validates conventions
│    Checks auth, types, security         │
│    Max 3 revision attempts              │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 3. Tester                               │ ← Generates Vitest tests
│    Happy path, edge cases, errors       │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 4. Optimizer                            │ ← Suggests improvements
│    Duplication, performance, readability│
└────────────┬────────────────────────────┘
             ↓
        Output: Code + Tests + Reasoning
```

## Files Overview

| File | Purpose |
|------|---------|
| `src/lib/multi-agent.ts` | State schema, context loaders, LLM client |
| `src/lib/agents/generator.ts` | Code generation node |
| `src/lib/agents/reviewer.ts` | Code review & validation node |
| `src/lib/agents/tester.ts` | Test generation node |
| `src/lib/agents/optimizer.ts` | Code optimization node |
| `src/lib/graph-router.ts` | Graph orchestration, revision loop |
| `src/bin/multi-agent-cli.ts` | CLI interface |

## Troubleshooting

**"Anthropic API key not found"**
- Ensure ANTHROPIC_API_KEY environment variable is set
- Check variable is set before running npm command

**"Error loading GymApp context"**
- Ensure CLAUDE.md exists in project root
- Check src/types/supabase.ts, src/app/(dashboard)/coach/student/actions.ts exist

**Tests fail after generation**
- Review generated code for Supabase client usage
- Check error messages in output

## Next Steps

1. Set ANTHROPIC_API_KEY environment variable
2. Run a test generation: `npm run generate -- --type server-action --requirement "..."`
3. Review generated code and test
4. Integrate into development workflow
