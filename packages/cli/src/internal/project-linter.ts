/**
 * Project-wide linter.
 * Inlined from @seeyourai/lint-rules for the OSS CLI.
 *
 * Runs MCP, skills, and budget analysis across the project.
 */

import fs from "node:fs";
import path from "node:path";
import { analyzeContextFootprint } from "./context-footprint.js";
import { detectAndAnalyzeMCP } from "./mcp-detector.js";
import { analyzeSkillFootprint, type SkillFootprint } from "./skill-footprint.js";
import type { LintIssue } from "./types.js";

export interface ProjectLintResult {
	mcpFootprint: {
		totalTokens: number;
		serverCount: number;
		issues: LintIssue[];
		servers: Array<{
			name: string;
			source: string;
			scope: "user" | "project";
			toolCount: number;
			tokenImpact: number;
			tools: Array<{
				name: string;
				description?: string;
				estimatedTokens: number;
				inputSchema?: Record<string, unknown>;
			}>;
		}>;
	};
	skillFootprint: SkillFootprint;
	contextBudget: {
		totalTokens: number;
		fileTokens: number;
		mcpTokens: number;
		skillTokens: number;
		budgetTokens: number;
		taxPercent: number;
		exceeded: boolean;
		issues: LintIssue[];
	} | null;
	overallScore: number;
}

export interface ProjectLintOptions {
	projectDir?: string;
	livePing?: boolean;
	budgetConfig?: ContextBudgetConfig;
}

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
	"claude-opus-4-6": 200_000,
	"claude-sonnet-4-6": 200_000,
	"claude-haiku-4-5-20251001": 200_000,
	"gpt-5.2": 200_000,
	"gpt-5-mini": 128_000,
	"gpt-5.2-codex": 200_000,
	"gemini-3.1-pro-preview": 1_000_000,
	"gemini-2.5-flash": 1_000_000,
};

const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEFAULT_MAX_TAX_PERCENT = 20;
const DEFAULT_REFERENCE_MODEL = "claude-sonnet-4-6";
const LARGE_SKILL_THRESHOLD = 5_000;

export interface ContextBudgetConfig {
	maxContextTaxPercent: number;
	maxContextTaxTokens?: number;
	referenceModel: string;
}

export const DEFAULT_BUDGET_CONFIG: ContextBudgetConfig = {
	maxContextTaxPercent: DEFAULT_MAX_TAX_PERCENT,
	referenceModel: DEFAULT_REFERENCE_MODEL,
};

function loadBudgetConfig(projectRoot: string): ContextBudgetConfig {
	const configPath = path.join(projectRoot, "syaconfig.json");
	if (!fs.existsSync(configPath)) {
		return { ...DEFAULT_BUDGET_CONFIG };
	}

	try {
		const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		const budget = raw?.contextBudget ?? {};
		return {
			maxContextTaxPercent:
				typeof budget.maxContextTaxPercent === "number"
					? budget.maxContextTaxPercent
					: DEFAULT_MAX_TAX_PERCENT,
			maxContextTaxTokens:
				typeof budget.maxContextTaxTokens === "number" ? budget.maxContextTaxTokens : undefined,
			referenceModel:
				typeof budget.referenceModel === "string" ? budget.referenceModel : DEFAULT_REFERENCE_MODEL,
		};
	} catch {
		return { ...DEFAULT_BUDGET_CONFIG };
	}
}

export async function lintProject(options: ProjectLintOptions = {}): Promise<ProjectLintResult> {
	const projectDir = options.projectDir ?? process.cwd();

	// ── MCP Analysis ────────────────────────────────────────────────────
	const mcpStats = await detectAndAnalyzeMCP(undefined, {
		livePing: options.livePing ?? false,
		projectDir,
	});
	const mcpIssues: LintIssue[] = [];

	if (mcpStats.totalTokenImpact > 20000) {
		mcpIssues.push({
			ruleId: "mcp-footprint-bloat",
			severity: "warning",
			message: `MCP tool definitions are consuming ${mcpStats.totalTokenImpact.toLocaleString()} tokens.`,
			suggestion: "Disable unused MCP servers to free up context window.",
		});
	}

	if (mcpStats.totalServers > 10) {
		mcpIssues.push({
			ruleId: "mcp-server-count",
			severity: "info",
			message: `Large number of MCP servers detected (${mcpStats.totalServers}).`,
			suggestion: "Consolidate servers or remove redundant ones to reduce overhead.",
		});
	}

	const heuristicServers = mcpStats.servers.filter((s) => s.tools.length === 0);
	if (heuristicServers.length > 0 && mcpStats.servers.length > 0) {
		mcpIssues.push({
			ruleId: "mcp-heuristic-estimate",
			severity: "info",
			message: `${heuristicServers.length} MCP server(s) using heuristic token estimates (no live data).`,
			suggestion: "Run 'sya optimize --mcp' to live-ping servers for accurate tool counts.",
		});
	}

	const SCHEMA_BLOAT_THRESHOLD = 200;
	const bloatedTools: Array<{ server: string; tool: string; tokens: number }> = [];
	for (const server of mcpStats.servers) {
		for (const tool of server.tools) {
			if (tool.estimatedTokens > SCHEMA_BLOAT_THRESHOLD) {
				bloatedTools.push({
					server: server.name,
					tool: tool.name,
					tokens: tool.estimatedTokens,
				});
			}
		}
	}
	if (bloatedTools.length > 0) {
		const totalBloat = bloatedTools.reduce((sum, t) => sum + t.tokens, 0);
		const toolList = bloatedTools
			.slice(0, 5)
			.map((t) => `${t.server}/${t.tool} (~${t.tokens} tok)`)
			.join(", ");
		const suffix = bloatedTools.length > 5 ? ` and ${bloatedTools.length - 5} more` : "";
		mcpIssues.push({
			ruleId: "mcp-schema-bloat",
			severity: "warning",
			message: `${bloatedTools.length} MCP tool(s) have schemas exceeding ${SCHEMA_BLOAT_THRESHOLD} tokens (~${totalBloat.toLocaleString()} tok total): ${toolList}${suffix}`,
			suggestion:
				"Large tool schemas consume context on every request. Consider simplifying parameter schemas or splitting tools.",
		});
	}

	// ── Skill Footprint ─────────────────────────────────────────────────
	const skillFootprint = analyzeSkillFootprint(projectDir);

	// ── Context Budget ──────────────────────────────────────────────────
	const claudeMdPath = path.join(projectDir, "CLAUDE.md");
	const agentsMdPath = path.join(projectDir, "AGENTS.md");
	const rootPath = fs.existsSync(claudeMdPath)
		? claudeMdPath
		: fs.existsSync(agentsMdPath)
			? agentsMdPath
			: null;

	let contextBudget: ProjectLintResult["contextBudget"] = null;

	if (rootPath) {
		const footprint = analyzeContextFootprint(rootPath, projectDir);
		const fileTokens = footprint.totalTokens;
		const mcpTokens = mcpStats.totalTokenImpact;
		const skillTokens = skillFootprint.totalTokens;
		const totalTokens = fileTokens + mcpTokens + skillTokens;

		const config = options.budgetConfig ?? loadBudgetConfig(projectDir);
		const contextWindow = MODEL_CONTEXT_WINDOWS[config.referenceModel] ?? DEFAULT_CONTEXT_WINDOW;
		const budgetTokens =
			config.maxContextTaxTokens ?? Math.floor(contextWindow * (config.maxContextTaxPercent / 100));
		const taxPercent = (totalTokens / contextWindow) * 100;
		const exceeded = totalTokens > budgetTokens;

		const budgetIssues: LintIssue[] = [];

		if (exceeded) {
			const breakdown = [
				`Files ${fileTokens.toLocaleString()}`,
				`MCP ${mcpTokens.toLocaleString()}`,
				`Skills ${skillTokens.toLocaleString()}`,
			].join(" | ");

			budgetIssues.push({
				ruleId: "context-budget",
				severity: "warning",
				message: `Context budget exceeded: ${totalTokens.toLocaleString()} tokens (${taxPercent.toFixed(1)}%) > ${config.maxContextTaxTokens ? `${budgetTokens.toLocaleString()} token limit` : `${config.maxContextTaxPercent}% of ${config.referenceModel}`}. Breakdown: ${breakdown}`,
				suggestion:
					"Reduce context tax by removing unused MCP servers, trimming large SKILL.md files, or consolidating linked documents.",
			});
		}

		for (const skill of skillFootprint.skills) {
			if (skill.tokens > LARGE_SKILL_THRESHOLD) {
				budgetIssues.push({
					ruleId: "context-budget",
					severity: "info",
					message: `Skill "${skill.name}" is ${skill.tokens.toLocaleString()} tokens (${skill.relativePath}).`,
					suggestion:
						"Consider splitting large skills or extracting code blocks to separate files.",
				});
			}
		}

		contextBudget = {
			totalTokens,
			fileTokens,
			mcpTokens,
			skillTokens,
			budgetTokens,
			taxPercent,
			exceeded,
			issues: budgetIssues,
		};
	}

	// ── Score ────────────────────────────────────────────────────────────
	let score = 100;
	score -= mcpIssues.filter((i) => i.severity === "error").length * 10;
	score -= mcpIssues.filter((i) => i.severity === "warning").length * 5;
	if (contextBudget?.exceeded) score -= 10;
	if (mcpStats.totalTokenImpact > 50000) score -= 20;
	score = Math.max(0, score);

	return {
		mcpFootprint: {
			totalTokens: mcpStats.totalTokenImpact,
			serverCount: mcpStats.totalServers,
			issues: mcpIssues,
			servers: mcpStats.servers.map((s) => ({
				name: s.name,
				source: s.source,
				scope: s.scope,
				toolCount: s.toolCount,
				tokenImpact: s.tokenImpact,
				tools: s.tools,
			})),
		},
		skillFootprint,
		contextBudget,
		overallScore: score,
	};
}
