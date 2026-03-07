import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	formatResults,
	formatResultsJson,
	listEvals,
	loadEvalSuite,
	runEvalSuite,
} from "@seeyourai/eval-runner";
import chalk from "chalk";
import type { Command } from "commander";

const EXAMPLE_EVAL = `name: example-eval
description: "Example eval — verifies the agent creates a file following project patterns"
eval_type: agent
prompt: |
  Create a new file called hello.txt with the content "Hello from seeyourai eval!"
assertions:
  - type: file_exists
    path: "hello.txt"
    description: "Agent should create hello.txt"
  - type: file_contains
    path: "hello.txt"
    pattern: "Hello"
    description: "File should contain a greeting"
timeout: 60
tags: [example, agent]
`;

const STATIC_EVAL = `name: context-quality
description: "Static eval — checks context file quality without spawning an agent"
eval_type: static
assertions:
  - type: max_context_tokens
    limit: 10000
    description: "Total context should be under 10,000 tokens"
  - type: no_dead_imports
    description: "All file references in CLAUDE.md should resolve"
  - type: section_exists
    heading: "Overview"
    description: "CLAUDE.md should have an Overview section"
  - type: no_vague_language
    description: "CLAUDE.md should not contain vague instructions"
  - type: max_section_tokens
    limit: 2000
    description: "No single section should exceed 2,000 tokens"
tags: [static, context-quality]
`;

const EXAMPLE_SUITE_CONFIG = `version: 1
suite:
  name: "my-project-evals"
  agent: "claude"
defaults:
  timeout: 120
`;

export function registerEvalCommand(program: Command): void {
	const evalCmd = program
		.command("eval")
		.description("Run context engineering evals against your AI agent");

	evalCmd
		.command("init")
		.description("Scaffold .seeyourai/evals/ directory with an example eval")
		.action(() => {
			const cwd = process.cwd();
			const evalsDir = path.join(cwd, ".seeyourai", "evals");
			const suiteConfigPath = path.join(cwd, ".seeyourai", "evals.yaml");

			if (existsSync(evalsDir)) {
				console.log(chalk.yellow("  .seeyourai/evals/ already exists. Skipping init."));
				return;
			}

			mkdirSync(evalsDir, { recursive: true });
			writeFileSync(path.join(evalsDir, "example-eval.yaml"), EXAMPLE_EVAL);
			writeFileSync(path.join(evalsDir, "context-quality.yaml"), STATIC_EVAL);

			if (!existsSync(suiteConfigPath)) {
				writeFileSync(suiteConfigPath, EXAMPLE_SUITE_CONFIG);
			}

			console.log(chalk.green("\n  Eval suite initialized!\n"));
			console.log(
				`  ${chalk.dim("Created:")} .seeyourai/evals/example-eval.yaml  ${chalk.cyan("(agent)")}`,
			);
			console.log(
				`  ${chalk.dim("Created:")} .seeyourai/evals/context-quality.yaml  ${chalk.cyan("(static)")}`,
			);
			console.log(`  ${chalk.dim("Created:")} .seeyourai/evals.yaml`);
			console.log(
				`\n  ${chalk.dim("Next:")} Run ${chalk.bold("sya eval run --filter static")} to run static evals (instant, free).\n`,
			);
		});

	evalCmd
		.command("list")
		.description("List available eval cases")
		.action(() => {
			const cwd = process.cwd();
			const evals = listEvals(cwd);

			if (evals.length === 0) {
				console.log(chalk.yellow("\n  No evals found. Run `sya eval init` to get started.\n"));
				return;
			}

			console.log(chalk.bold("\n  Available evals:\n"));
			for (const name of evals) {
				console.log(`    ${chalk.cyan(name)}`);
			}
			console.log("");
		});

	evalCmd
		.command("run [name]")
		.description("Run evals and output results")
		.option("--json", "Output results as JSON")
		.option("--filter <pattern>", "Only run evals matching pattern")
		.option("--verbose", "Show agent stdout")
		.action(async (name: string | undefined, options) => {
			const cwd = process.cwd();

			// Load suite
			const { config, cases } = loadEvalSuite(cwd);

			if (cases.length === 0) {
				console.log(chalk.yellow("\n  No evals found. Run `sya eval init` to get started.\n"));
				return;
			}

			// Filter to specific eval if name provided
			let filter = options.filter;
			if (name) {
				filter = `^${name}$`;
			}

			// Run evals
			const result = await runEvalSuite({
				cwd,
				config,
				cases,
				filter,
				onProgress: (evalName, status, index, total) => {
					if (!options.json) {
						if (status === "running") {
							process.stdout.write(
								`\r  ${chalk.dim(`[${index + 1}/${total}]`)} Running ${chalk.bold(evalName)}...`,
							);
						}
					}
				},
			});

			// Clear progress line
			if (!options.json) {
				process.stdout.write("\r\x1b[K");
			}

			// Output results
			if (options.json) {
				console.log(formatResultsJson(result));
			} else {
				console.log(formatResults(result));

				if (options.verbose) {
					for (const r of result.results) {
						if (r.agentOutput) {
							console.log(chalk.bold(`  --- ${r.name} stdout ---`));
							console.log(r.agentOutput);
							console.log("");
						}
					}
				}

				// Save results locally
				const resultsDir = path.join(cwd, ".seeyourai", "results");
				mkdirSync(resultsDir, { recursive: true });
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
				const resultsPath = path.join(resultsDir, `${timestamp}.json`);
				writeFileSync(resultsPath, formatResultsJson(result));
				console.log(`  ${chalk.dim("Results saved to")} ${resultsPath}\n`);
			}

			// Exit with error code if any evals failed
			if (result.summary.failed > 0) {
				process.exit(1);
			}
		});
}
