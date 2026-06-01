#!/usr/bin/env node

import { Command } from "commander";
import { runMultiAgentFlow, formatSummary } from "../lib/graph-router.js";
import * as fs from "fs";
import * as path from "path";

const program = new Command();

program
  .name("gymapp-generate")
  .description("Generate code using GymApp multi-agent system")
  .version("0.1.0");

program
  .command("generate")
  .description("Generate code for a feature")
  .requiredOption(
    "--type <type>",
    "Type of code: server-action, api-route, hook, component"
  )
  .requiredOption(
    "--requirement <requirement>",
    "Feature requirement description"
  )
  .option("--context <context>", "Context as JSON (e.g., {\"dataModel\": \"training_plan\"})")
  .option("--output", "Save output to files")
  .action(async (options) => {
    const startTime = Date.now();

    try {
      // Parse context if provided
      let context = {};
      if (options.context) {
        try {
          context = JSON.parse(options.context);
        } catch {
          console.error("❌ Invalid JSON in --context");
          process.exit(1);
        }
      }

      console.log("🚀 Starting multi-agent code generation...\n");

      const result = await runMultiAgentFlow({
        requirement: options.requirement,
        codeType: options.type as any,
        context,
      });

      console.log(formatSummary(result));

      // Display generated code
      console.log("\n📝 GENERATED CODE:\n");
      console.log("```typescript");
      console.log(result.generatedCode);
      console.log("```\n");

      // Display tests if available
      if (result.testCode) {
        console.log("🧪 GENERATED TESTS:\n");
        console.log("```typescript");
        console.log(result.testCode);
        console.log("```\n");
      }

      // Save to files if requested
      if (options.output) {
        const projectRoot = process.cwd();
        const timestamp = new Date().toISOString().split("T")[0];

        // Save code
        const codeFilename = `generated-${options.type}-${timestamp}.ts`;
        const codePath = path.join(projectRoot, "src/lib/generated", codeFilename);
        fs.mkdirSync(path.dirname(codePath), { recursive: true });
        fs.writeFileSync(codePath, result.generatedCode);
        console.log(`✅ Code saved to: ${codeFilename}`);

        // Save tests if available
        if (result.testCode) {
          const testFilename = `generated-${options.type}.test.ts`;
          const testPath = path.join(projectRoot, "test", testFilename);
          fs.mkdirSync(path.dirname(testPath), { recursive: true });
          fs.writeFileSync(testPath, result.testCode);
          console.log(`✅ Tests saved to: ${testFilename}`);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Total time: ${(elapsed / 1000).toFixed(1)}s`);

      if (result.errors.length > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error(
        "❌ Error:",
        err instanceof Error ? err.message : String(err)
      );
      process.exit(1);
    }
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
