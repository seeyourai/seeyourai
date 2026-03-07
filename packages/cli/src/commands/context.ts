import * as fs from "node:fs";
import * as path from "node:path";
import {
	costPerRequest as computeCostPerReq,
	DISPLAY_MODELS,
	fmtCost,
	getInputPricing,
	summarizeJsonSchema,
} from "@seeyourai/core";
import { analyzeContextFootprint, LintEngine, lintProject } from "@seeyourai/lint-rules";
import chalk from "chalk";
import { loadConfig } from "../config.js";

interface OptimizeOptions {
	minTokens?: number;
	apply?: boolean;
	json?: boolean;
	silent?: boolean;
}

/** Session cost profiles for tangible cost projections */
const SESSION_PROFILES = [
	{ name: "simple task (10 reqs)", requests: 10 },
	{ name: "typical session (30 reqs)", requests: 30 },
	{ name: "complex + subagents (100 reqs)", requests: 100 },
];

/**
 * Static Context Audit Command
 *
 * Scans context files, MCP servers, and linked docs to report token counts,
 * per-request costs across models, and lint issues.
 */
export async function contextCommand(options: OptimizeOptions = {}): Promise<any> {
	const cwd = process.cwd();

	if (!options.json && !options.silent) {
		const label = options.apply ? "sya optimize" : "sya context";
		console.log(chalk.bold.cyan(`\n  ${label}\n`));
	}

	const staticResult = await runStaticAudit(cwd, options.apply, options.json || !!options.silent);

	// Print session cost projections
	if (!options.json && !options.silent && staticResult.footprint) {
		printSessionCostProjections(staticResult.footprint, staticResult.mcp, staticResult.skills);
	}

	// Print summary banner
	if (!options.json && !options.silent) {
		printSummary(staticResult);
	}

	if (options.json) {
		process.stdout.write(`${JSON.stringify(staticResult, null, 2)}\n`);
	}

	return staticResult;
}

/**
 * Print session cost projections to make per-request costs tangible.
 */
function printSessionCostProjections(
	footprint: { totalTokens: number; costPerRequest: Record<string, number> },
	mcp: { totalTokens: number },
	skills: { totalTokens: number },
): void {
	const config = loadConfig();
	const costConfig = config.costEstimation;
	const modelId = costConfig?.model || "claude-sonnet-4-6";
	const profiles = costConfig?.sessionProfiles || SESSION_PROFILES;

	const inputPrices = getInputPricing();
	const pricePerTok = inputPrices[modelId];
	if (!pricePerTok) return;

	const totalTokens = footprint.totalTokens + mcp.totalTokens + skills.totalTokens;
	const costPerReq = computeCostPerReq(totalTokens, pricePerTok);

	// Find a display label for the model
	const modelLabel = DISPLAY_MODELS.find((m) => m.id === modelId)?.label || modelId;

	console.log(chalk.bold("━━ Session Cost Projections ━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
	console.log(
		chalk.gray(
			`  Based on ${chalk.white(totalTokens.toLocaleString())} context tokens loaded per request (${modelLabel}):`,
		),
	);
	console.log();

	for (const profile of profiles) {
		const sessionCost = costPerReq * profile.requests;
		const costStr =
			sessionCost < 0.01 ? `$${sessionCost.toFixed(4)}` : `$${sessionCost.toFixed(2)}`;
		console.log(`    ${chalk.white(profile.name.padEnd(32))} ${chalk.yellow.bold(costStr)}`);
	}

	console.log();
	console.log(
		chalk.dim(
			`  This is your "context tax" — paid before the agent reads a single line of your code.`,
		),
	);
	console.log(
		chalk.dim(`  Reduce it by removing unused files, MCP servers, or running 'sya optimize'.`),
	);
	console.log();
}

/**
 * Print a concise summary banner at the end.
 */
function printSummary(result: any): void {
	const { totals, footprint, mcp, skills } = result;

	console.log(chalk.bold("━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

	if (totals.errors > 0) {
		console.log(
			chalk.red(`  ${totals.errors} error${totals.errors > 1 ? "s" : ""}  `) +
				chalk.yellow(`${totals.warnings} warning${totals.warnings > 1 ? "s" : ""}`),
		);
	} else if (totals.warnings > 0) {
		console.log(
			chalk.yellow(`  ${totals.warnings} warning${totals.warnings > 1 ? "s" : ""}  `) +
				chalk.green("0 errors"),
		);
	} else {
		console.log(chalk.green("  No issues found."));
	}

	if (footprint) {
		const totalTokens =
			footprint.totalTokens + (mcp?.totalTokens || 0) + (skills?.totalTokens || 0);
		console.log(chalk.gray(`  Context tax: ${totalTokens.toLocaleString()} tokens per request`));
	}

	if (totals.errors > 0 || totals.warnings > 0) {
		console.log(chalk.dim(`\n  Run ${chalk.white("sya optimize")} to auto-fix issues.`));
	}

	console.log(chalk.dim(`  Run ${chalk.white("sya mcp")} for detailed MCP server analysis.\n`));
}

/**
 * Run static analysis of the project structure and capabilities
 */
async function runStaticAudit(cwd: string, applyFixes = false, isJson = false): Promise<any> {
	const claudeMdPath = path.join(cwd, "CLAUDE.md");
	const agentsMdPath = path.join(cwd, "AGENTS.md");
	const engine = new LintEngine();

	if (!isJson) {
		console.log(chalk.bold("━━ Context Audit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
	}

	const files: Record<string, any> = {};

	// Auto-fix static issues if requested
	const toProcess = [];
	if (fs.existsSync(claudeMdPath)) toProcess.push({ path: claudeMdPath, label: "CLAUDE.md" });
	if (fs.existsSync(agentsMdPath)) toProcess.push({ path: agentsMdPath, label: "AGENTS.md" });

	if (toProcess.length === 0 && !isJson) {
		console.log(chalk.yellow("  No CLAUDE.md or AGENTS.md found in this directory."));
		console.log(chalk.gray("  These files define your agent's context window."));
		console.log(chalk.gray("  Create a CLAUDE.md to get started, then re-run seeyourai.\n"));
	}

	for (const { path: filePath, label } of toProcess) {
		let content = fs.readFileSync(filePath, "utf-8");
		if (applyFixes) {
			const fixedContent = await engine.fix(filePath, content);
			if (fixedContent !== content) {
				fs.writeFileSync(filePath, fixedContent);
				if (!isJson) console.log(chalk.green(`  Fixed structural issues in ${label}`));
				content = fixedContent;
			}
		}
		const lintRes = await engine.lint(filePath, content);
		files[label] = {
			errors: lintRes.issues.filter((i) => i.severity === "error").length,
			warnings: lintRes.issues.filter((i) => i.severity === "warning").length,
			infos: lintRes.issues.filter((i) => i.severity === "info").length,
			issues: lintRes.issues,
		};

		// Print lint issues inline for visibility
		if (!isJson) {
			const errs = lintRes.issues.filter((i) => i.severity === "error");
			const warns = lintRes.issues.filter((i) => i.severity === "warning");
			if (errs.length > 0 || warns.length > 0) {
				for (const issue of errs) {
					console.log(`    ${chalk.red("error")} ${chalk.white(label)}: ${issue.message}`);
				}
				for (const issue of warns) {
					console.log(`    ${chalk.yellow("warn")}  ${chalk.white(label)}: ${issue.message}`);
				}
			} else {
				console.log(`  ${chalk.green("ok")}  ${label}`);
			}
		}
	}

	if (toProcess.length > 0 && !isJson) console.log();

	// Project-level MCP Footprint (scans user + project configs)
	// Pass budget config from CLI's loadConfig() to avoid duplicate syaconfig.json reads
	const cliConfig = loadConfig(cwd);
	const budgetConfig = cliConfig.contextBudget
		? {
				maxContextTaxPercent: cliConfig.contextBudget.maxContextTaxPercent,
				maxContextTaxTokens: cliConfig.contextBudget.maxContextTaxTokens,
				referenceModel: cliConfig.contextBudget.referenceModel,
			}
		: undefined;
	const projectLint = await lintProject({ projectDir: cwd, budgetConfig });
	const mcp = projectLint.mcpFootprint;
	const mcpTokColor = mcp.totalTokens < 10000 ? chalk.green : chalk.yellow;

	if (!isJson) {
		console.log(
			`  ${chalk.magenta("MCP Servers")}  ${mcpTokColor.bold(mcp.totalTokens.toLocaleString())} tokens (${mcp.serverCount} servers)`,
		);

		// Per-server breakdown
		if (mcp.servers.length > 0) {
			for (const server of mcp.servers) {
				const scopeTag =
					server.scope === "project" ? chalk.cyan("[project]") : chalk.gray("[user]");
				const sourceTag = chalk.dim(`(${server.source})`);
				const tokStr =
					server.tokenImpact < 1000
						? chalk.green(`~${server.tokenImpact}`)
						: chalk.yellow(`~${server.tokenImpact.toLocaleString()}`);
				console.log(
					`    ${chalk.gray("-")} ${chalk.white(server.name.padEnd(24))} ${tokStr} tokens  ${server.toolCount} tools  ${scopeTag} ${sourceTag}`,
				);

				// Show individual tool details if we have them (from live ping)
				if (server.tools.length > 0) {
					for (const tool of server.tools.slice(0, 5)) {
						const paramSummary = summarizeJsonSchema(tool.inputSchema);
						const paramStr = paramSummary ? chalk.dim(` (${paramSummary})`) : "";
						console.log(
							`      ${chalk.dim("·")} ${chalk.dim(tool.name.padEnd(30))} ${chalk.dim(`~${tool.estimatedTokens} tok`)}${paramStr}`,
						);
					}
					if (server.tools.length > 5) {
						console.log(chalk.dim(`      ...and ${server.tools.length - 5} more tools`));
					}
				}
			}
		}

		for (const issue of mcp.issues) {
			console.log(`    ${chalk.red("x")} ${issue.message}`);
			if (issue.suggestion) console.log(chalk.gray(`      -> ${issue.suggestion}`));
		}
	}

	// Skill Footprint (from .agents/skills/)
	const skills = projectLint.skillFootprint;
	if (!isJson && skills.totalSkills > 0) {
		const skillTokColor = skills.totalTokens < 5000 ? chalk.green : chalk.yellow;
		console.log(
			`  ${chalk.yellow("Skills")}       ${skillTokColor.bold(skills.totalTokens.toLocaleString())} tokens (${skills.totalSkills} skill${skills.totalSkills > 1 ? "s" : ""})`,
		);
		for (const skill of skills.skills) {
			const tokLabel =
				skill.tokens >= 1000 ? `${(skill.tokens / 1000).toFixed(1)}k` : `${skill.tokens}`;
			const label = skill.frontmatter.name || skill.name;
			console.log(
				`    ${chalk.gray("-")} ${chalk.white(label.padEnd(24))} ${chalk.dim(`~${tokLabel} tok`)}  ${chalk.dim(skill.relativePath)}`,
			);
		}
	}

	// Context Budget
	const budget = projectLint.contextBudget;
	if (!isJson && budget) {
		for (const issue of budget.issues) {
			const severity = issue.severity === "warning" ? chalk.yellow("warn") : chalk.blue("info");
			console.log(`    ${severity}  ${issue.message}`);
			if (issue.suggestion) console.log(chalk.gray(`      -> ${issue.suggestion}`));
		}
	}

	// Context Footprint (Linked files)
	const rootPath = fs.existsSync(claudeMdPath)
		? claudeMdPath
		: fs.existsSync(agentsMdPath)
			? agentsMdPath
			: null;
	const fp = rootPath ? analyzeContextFootprint(rootPath, cwd) : null;

	if (fp) {
		for (const f of fp.files) {
			if (!f.exists) {
				files[f.relativePath] = {
					errors: 1,
					warnings: 0,
					infos: 0,
					issues: [
						{
							ruleId: "broken-links",
							severity: "error",
							message: `Missing context file: ${f.relativePath}`,
							suggestion: `Check why this file is referenced but missing. Loaded by: ${f.loadedBy.map((p) => path.relative(cwd, p)).join(", ")}`,
						},
					],
				};
			}
		}
	}

	const pricing: Record<string, number> = {};
	if (fp) {
		const tokColor =
			fp.totalTokens < 20000 ? chalk.green : fp.totalTokens < 50000 ? chalk.yellow : chalk.red;
		if (!isJson) {
			console.log(
				`  ${chalk.blue("Linked Files")} ${tokColor.bold(fp.totalTokens.toLocaleString())} tokens (${fp.files.length} files)`,
			);

			// Show individual files for transparency
			for (const f of fp.files.slice(0, 8)) {
				const tokLabel = f.tokens >= 1000 ? `${(f.tokens / 1000).toFixed(1)}k` : `${f.tokens}`;
				const existsTag = f.exists ? "" : chalk.red(" [MISSING]");
				console.log(
					`    ${chalk.gray("-")} ${chalk.white(f.relativePath.padEnd(40))} ${chalk.dim(`~${tokLabel} tok`)}${existsTag}`,
				);
			}
			if (fp.files.length > 8) {
				console.log(chalk.dim(`    ...and ${fp.files.length - 8} more files`));
			}
		}

		// Pricing row
		const inputPrices = getInputPricing();
		const totalTokens = fp.totalTokens + mcp.totalTokens + skills.totalTokens;

		const parts = DISPLAY_MODELS.map(({ id, label }) => {
			const pricePerTok = inputPrices[id];
			const cost = computeCostPerReq(totalTokens, pricePerTok || 0);
			pricing[label] = cost;
			return `${chalk.bold(label)} ${chalk.yellow(`${fmtCost(cost)}/req`)}`;
		});

		if (!isJson) {
			console.log();
			console.log(chalk.bold("━━ Cost Per Request ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
			console.log(chalk.gray(`  Your context tax across models:\n`));
			for (const part of parts) {
				console.log(`    ${part}`);
			}
			if (fp.missingFiles.length > 0) {
				console.log(
					chalk.red(`\n    ${fp.missingFiles.length} broken references found in context graph.`),
				);
			}
		}
	} else {
		if (!isJson) {
			console.log(chalk.gray("  (No CLAUDE.md found — skipping file footprint analysis)"));
		}
	}

	if (!isJson) console.log();

	const budgetIssueCount = budget?.issues.filter((i) => i.severity === "warning").length ?? 0;

	return {
		files,
		totals: {
			errors: Object.values(files).reduce((acc, f) => acc + f.errors, 0) + mcp.issues.length,
			warnings: Object.values(files).reduce((acc, f) => acc + f.warnings, 0) + budgetIssueCount,
			infos: Object.values(files).reduce((acc, f) => acc + f.infos, 0),
		},
		mcp,
		skills: {
			totalTokens: skills.totalTokens,
			totalSkills: skills.totalSkills,
			skills: skills.skills,
		},
		footprint: fp
			? {
					totalTokens: fp.totalTokens,
					fileCount: fp.files.length,
					missingCount: fp.missingFiles.length,
					files: fp.files,
					costPerRequest: pricing,
				}
			: null,
		contextBudget: budget,
	};
}
