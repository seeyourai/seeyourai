import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	ContextAnalyzer,
	costPerRequest as computeCostPerReq,
	DISPLAY_MODELS,
	detectAndAnalyzeMCP,
	FileStorage,
	fmtCost,
	getInputPricing,
	type SessionMeta,
	summarizeJsonSchema,
} from "@seeya/core";
import { analyzeContextFootprint, LintEngine, lintProject } from "@seeya/lint-rules";
import chalk from "chalk";
import { loadConfig } from "../config.js";

interface OptimizeOptions {
	session?: string;
	all?: boolean;
	minTokens?: number;
	list?: boolean;
	apply?: boolean;
	mcp?: boolean;
	static?: boolean;
	json?: boolean;
	updateBaseline?: boolean;
	silent?: boolean;
}

/** Session cost profiles for tangible cost projections */
const SESSION_PROFILES = [
	{ name: "simple task (10 reqs)", requests: 10 },
	{ name: "typical session (30 reqs)", requests: 30 },
	{ name: "complex + subagents (100 reqs)", requests: 100 },
];

/**
 * Unified Context Optimization & Audit Command
 *
 * Default behavior: static audit only (zero-setup, instant value).
 * Use --full for dynamic session analysis (requires trace data).
 */
export async function contextCommand(options: OptimizeOptions = {}): Promise<any> {
	// Default to static-only unless explicitly running full analysis
	const isStaticOnly = options.static !== false && !options.session && !options.all;

	if (!options.json && !options.silent) {
		const label = options.apply ? "sya optimize" : "sya context";
		console.log(chalk.bold.cyan(`\n  ${label}\n`));
	}
	const cwd = process.cwd();

	// 1. Static Capability Audit
	const staticResult = await runStaticAudit(cwd, options.apply, options.json || !!options.silent);

	if (isStaticOnly) {
		// Print session cost projections for the static audit
		if (!options.json && !options.silent && staticResult.footprint) {
			printSessionCostProjections(staticResult.footprint, staticResult.mcp, staticResult.skills);
		}

		// Print summary banner
		if (!options.json && !options.silent) {
			printSummary(staticResult);
		}

		if (options.updateBaseline) {
			await writeBaseline(cwd, { static: staticResult });
		}

		if (options.json) {
			process.stdout.write(`${JSON.stringify(staticResult, null, 2)}\n`);
		}
		return staticResult;
	}

	// 2. Dynamic Usage Audit (Dead Weight Analysis)
	const dynamicResult = await runDynamicAudit(options);

	if (options.updateBaseline) {
		await writeBaseline(cwd, { static: staticResult, dynamic: dynamicResult });
	}

	if (options.json) {
		process.stdout.write(
			`${JSON.stringify({ static: staticResult, dynamic: dynamicResult }, null, 2)}\n`,
		);
	}

	return { static: staticResult, dynamic: dynamicResult };
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

	console.log(
		chalk.dim(`  Run ${chalk.white("sya context --full")} for dynamic session analysis.\n`),
	);
}

/**
 * Write a baseline file for CI comparison
 */
async function writeBaseline(cwd: string, data: any): Promise<void> {
	const { dump: yamlDump } = await import("js-yaml");
	const baselinePath = path.join(cwd, "seeyourai-baseline.yaml");
	const header =
		"# seeyourai-baseline.yaml\n" +
		"# Auto-generated by `sya context --update-baseline`.\n" +
		"# Commit this file. Update it whenever you intentionally change your context docs.\n" +
		"# To regenerate: sya context --update-baseline\n\n";
	const yaml = yamlDump(data, { lineWidth: 100, noRefs: true });
	fs.writeFileSync(baselinePath, header + yaml);
	console.log(chalk.green(`  Baseline written to ${path.relative(cwd, baselinePath)}`));
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

/**
 * Run dynamic analysis by replaying session traces
 */
async function runDynamicAudit(options: OptimizeOptions): Promise<any> {
	const storagePath = path.join(os.homedir(), ".seeyourai", "events.jsonl");
	const storage = new FileStorage(storagePath);
	await storage.reload();
	const sessionMetas = await storage.getSessionIndex();

	if (sessionMetas.length === 0) {
		if (!options.json) {
			console.log(chalk.bold("━━ Dynamic Audit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
			console.log(chalk.gray("  No sessions found. Run your agent to enable usage analysis.\n"));
		}
		return { sessionsAnalyzed: 0 };
	}

	// Select sessions to analyze
	let sessionsToAnalyze: SessionMeta[] = [];
	if (options.all) {
		sessionsToAnalyze = sessionMetas;
	} else if (options.session) {
		const sessionPrefix = options.session;
		const found = sessionMetas.find(
			(s) => s.id === sessionPrefix || s.id.startsWith(sessionPrefix),
		);
		if (found) sessionsToAnalyze = [found];
	} else {
		const sorted = [...sessionMetas].sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
		);
		sessionsToAnalyze = [sorted[0]];
	}

	if (!options.json) {
		console.log(chalk.bold("━━ Dynamic Audit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
		console.log(
			chalk.gray(`  Replaying ${sessionsToAnalyze.length} session(s) to detect usage patterns...`),
		);
	}

	const analyzer = new ContextAnalyzer({ minTokenThreshold: options.minTokens || 100 });
	const usedMcpTools = new Map<string, Set<string>>();

	// Aggregate tool_overhead data from MITM interceptions (ground truth)
	const toolUsageCounts = new Map<string, number>(); // tool name -> invocation count
	const toolTokenEstimates = new Map<string, number>(); // tool name -> estimated tokens
	const toolParamCounts = new Map<string, number>(); // tool name -> parameter count
	let totalOverheadSamples = 0;
	let totalOverheadTokens = 0;

	for (const session of sessionsToAnalyze) {
		const events = await storage.getBySession(session.id);
		const pendingToolCalls = new Map<string, string[]>();

		for (const event of events) {
			if (event.eventType === "thought") {
				if ((event.metadata as any).contextWindow?.files) {
					const files = ((event.metadata as any).contextWindow.files as string[]).map((f) => ({
						path: f,
						sizeBytes: 0,
						tokens: 100,
						readCount: 0,
						lastAccessed: new Date().toISOString(),
					}));
					analyzer.recordContextSnapshot(event.id, files);
				}
			}

			if (event.eventType === "tool_call") {
				const payload = event.payload as any;
				if (payload.mcpServerName && payload.mcpToolName) {
					if (!usedMcpTools.has(payload.mcpServerName))
						usedMcpTools.set(payload.mcpServerName, new Set());
					usedMcpTools.get(payload.mcpServerName)?.add(payload.mcpToolName);
				}

				const name = payload.name || "";
				const args = payload.arguments || {};

				// Track every tool invocation for overhead analysis
				toolUsageCounts.set(name, (toolUsageCounts.get(name) || 0) + 1);

				if (["Read", "Edit", "grep"].includes(name)) {
					const filePath = args.path || args.file_path || args.file;
					if (filePath && typeof filePath === "string") pendingToolCalls.set(event.id, [filePath]);
				}
			}

			if (event.eventType === "tool_result") {
				const rp = event.payload as { success?: boolean; error?: string };
				const parentId = event.metadata?.parentId;
				if (parentId) {
					const files = pendingToolCalls.get(parentId);
					if (files && rp.success !== false && !rp.error) {
						analyzer.recordToolUsage(files);
						pendingToolCalls.delete(parentId);
					}
				}
			}

			// Consume tool_overhead events from MITM proxy
			if (event.eventType === "tool_overhead") {
				const payload = event.payload as any;
				totalOverheadSamples++;
				totalOverheadTokens += payload.estimatedTotalTokens || 0;

				// Record per-tool token estimates and param counts (keep the latest)
				if (Array.isArray(payload.tools)) {
					for (const tool of payload.tools) {
						if (tool.name && tool.estimatedTokens) {
							toolTokenEstimates.set(tool.name, tool.estimatedTokens);
						}
						if (tool.name && tool.inputSchema?.properties) {
							toolParamCounts.set(tool.name, Object.keys(tool.inputSchema.properties).length);
						}
					}
				}
			}
		}
	}

	const deadContext = analyzer.getDeadContext();
	const config = loadConfig();
	const mcpStats = await detectAndAnalyzeMCP(usedMcpTools, {
		livePing: config.mcp.deepScan,
		projectDir: process.cwd(),
	});

	// ── Tool Overhead Report (from live MITM data) ───────────────────────
	const hasLiveOverhead = totalOverheadSamples > 0;
	if (hasLiveOverhead) {
		// Build a sorted list of tools by token cost, marking which were never invoked
		const toolOverheadList = [...toolTokenEstimates.entries()]
			.map(([name, tokens]) => ({
				name,
				tokens,
				invocations: toolUsageCounts.get(name) || 0,
				paramCount: toolParamCounts.get(name) || 0,
			}))
			.sort((a, b) => b.tokens - a.tokens);

		const unusedToolDefs = toolOverheadList.filter((t) => t.invocations === 0);
		const wastedTokens = unusedToolDefs.reduce((sum, t) => sum + t.tokens, 0);
		const avgOverheadPerRequest = Math.round(totalOverheadTokens / totalOverheadSamples);
		const highCostTools = toolOverheadList.filter((t) => t.tokens > 100);

		if (!options.json) {
			console.log(
				chalk.bold(
					`\n  Tool Definitions  ${chalk.yellow(`${toolOverheadList.length} tools`)} sent per request (${chalk.yellow(`~${avgOverheadPerRequest.toLocaleString()} tokens`)})`,
				),
			);
			console.log(chalk.gray(`    (from ${totalOverheadSamples} intercepted API requests)`));

			// Show high-cost tool definitions (>100 tokens each)
			if (highCostTools.length > 0) {
				console.log(
					chalk.bold(`\n    High-cost schemas (${highCostTools.length} tools > 100 tokens each):`),
				);
				for (const t of highCostTools.slice(0, 10)) {
					const usageTag =
						t.invocations > 0 ? chalk.green(`${t.invocations}x`) : chalk.red("never used");
					const paramTag = t.paramCount > 0 ? chalk.dim(` ${t.paramCount} params`) : "";
					console.log(
						`    ${chalk.gray("-")} ${chalk.white(t.name.padEnd(30))} ${chalk.yellow(`~${t.tokens} tok`)}${paramTag}  ${usageTag}`,
					);
				}
				if (highCostTools.length > 10) {
					console.log(chalk.dim(`    ...and ${highCostTools.length - 10} more`));
				}
			}

			if (unusedToolDefs.length > 0) {
				console.log(
					chalk.red(
						`\n    ${unusedToolDefs.length} tools were never invoked (~${wastedTokens.toLocaleString()} tokens wasted per request):`,
					),
				);
				for (const t of unusedToolDefs.slice(0, 15)) {
					console.log(
						`    ${chalk.gray("-")} ${chalk.white(t.name.padEnd(30))} ${chalk.dim(`~${t.tokens} tokens`)}`,
					);
				}
				if (unusedToolDefs.length > 15) {
					console.log(chalk.gray(`    ...and ${unusedToolDefs.length - 15} more`));
				}
				console.log(
					chalk.yellow(
						"\n    Suggestion: Remove unused MCP servers or tools to reduce context overhead.",
					),
				);
			}
		}
	}

	// Report Dead MCP Servers (from config file discovery - fallback when no MITM data)
	const unusedServers = mcpStats.servers.filter((s) => s.toolsUsed === 0);
	if (unusedServers.length > 0) {
		if (!options.json) {
			console.log(
				chalk.red(
					`\n  Dead MCP Servers (${unusedServers.length} server${unusedServers.length > 1 ? "s" : ""})`,
				),
			);
			for (const s of unusedServers) {
				console.log(
					`    ${chalk.gray("-")} ${chalk.white(s.name.padEnd(20))} ${chalk.dim(`(~${s.tokenImpact} tokens wasted per prompt)`)}`,
				);
			}
			console.log(
				chalk.yellow("\n    Suggestion: Disable these in your config to speed up your agent."),
			);
		}
	}

	// Report Dead Files
	if (deadContext.length > 0) {
		if (!options.json) {
			console.log(chalk.red(`\n  Dead File Weight (${deadContext.length} files)`));
			console.log(chalk.gray("    Files present in context but NEVER used by the agent."));

			for (const file of deadContext.slice(0, 10)) {
				console.log(`    ${chalk.gray("-")} ${chalk.cyan(file.path)}`);
			}
			if (deadContext.length > 10)
				console.log(chalk.gray(`    ...and ${deadContext.length - 10} more`));
		}

		let totalWasted = 0;
		for (const file of deadContext) totalWasted += file.potentialSavings;
		const cost = (totalWasted / 1_000_000) * 3;

		if (!options.json) {
			console.log(
				chalk.dim(
					`\n    Estimated waste: ~${totalWasted} tokens per session (~${cost.toFixed(4)})`,
				),
			);
		}

		if (options.apply) {
			applyDeadFileFixes(deadContext.map((f) => f.path));
		} else if (!options.json) {
			console.log(
				chalk.yellow("\n    Suggestion: Run 'sya optimize' to add these to .claudeignore"),
			);
		}
	}

	if (!options.json && deadContext.length === 0 && unusedServers.length === 0 && !hasLiveOverhead) {
		console.log(chalk.green("\n  No obvious usage waste detected in recent sessions!"));
	}

	if (!options.json) console.log();

	// Build tool overhead result for JSON output
	const toolOverheadResult = hasLiveOverhead
		? {
				samplesAnalyzed: totalOverheadSamples,
				avgTokensPerRequest: Math.round(totalOverheadTokens / totalOverheadSamples),
				totalToolDefinitions: toolTokenEstimates.size,
				unusedTools: [...toolTokenEstimates.entries()]
					.filter(([name]) => !toolUsageCounts.has(name) || toolUsageCounts.get(name) === 0)
					.map(([name, tokens]) => ({ name, estimatedTokens: tokens })),
			}
		: null;

	return {
		sessionsAnalyzed: sessionsToAnalyze.length,
		unusedServers: unusedServers.map((s) => s.name),
		deadFiles: deadContext.map((f) => f.path),
		toolOverhead: toolOverheadResult,
	};
}

function applyDeadFileFixes(filesToAdd: string[]): void {
	const claudeignorePath = path.join(process.cwd(), ".claudeignore");
	let existing = "";
	if (fs.existsSync(claudeignorePath)) existing = fs.readFileSync(claudeignorePath, "utf-8");

	const existingLines = new Set(
		existing
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean),
	);
	const newEntries = filesToAdd.filter((f) => !existingLines.has(f));

	if (newEntries.length > 0) {
		const addition = `${existing.endsWith("\n") || existing === "" ? "" : "\n"}# Added by sya optimize\n${newEntries.join("\n")}\n`;
		fs.writeFileSync(claudeignorePath, existing + addition);
		console.log(chalk.green(`\n  Added ${newEntries.length} entries to .claudeignore`));
	}
}
