import * as fs from "node:fs";
import * as path from "node:path";
import select from "@inquirer/select";
import { costPerRequest as computeCostPerReq, fmtCost, getInputPricing } from "@seeya/core";
import { analyzeContextFootprint, lintProject } from "@seeya/lint-rules";
import chalk from "chalk";
import { Command } from "commander";
import { contextCommand } from "./commands/context.js";
import { registerEvalCommand } from "./commands/eval.js";
import { mcpCommand } from "./commands/mcp.js";
import { loadConfig } from "./config.js";

export { contextCommand } from "./commands/context.js";
export { registerEvalCommand } from "./commands/eval.js";
export { mcpCommand } from "./commands/mcp.js";

// ─── provider detection ─────────────────────────────────────────────────────

type Provider = "anthropic" | "openai" | "google";

interface Flagship {
	id: string;
	label: string;
	provider: Provider;
}

/** All flagship models we know about, one per provider. */
const ALL_FLAGSHIPS: Flagship[] = [
	{ id: "claude-sonnet-4-6", label: "Sonnet 4.6", provider: "anthropic" },
	{ id: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
	{ id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "google" },
];

/** Map MCP server source strings to providers. */
const SOURCE_TO_PROVIDER: Record<string, Provider> = {
	"claude-code": "anthropic",
	"claude-desktop": "anthropic",
	cursor: "openai",
	vscode: "openai",
	codex: "openai",
	antigravity: "google",
	kiro: "google",
};

/** Detect which AI providers are active based on context files and MCP sources. */
function detectProviders(cwd: string, mcpSources: string[]): Set<Provider> {
	const providers = new Set<Provider>();

	// Context files → provider
	if (fs.existsSync(path.join(cwd, "CLAUDE.md")) || fs.existsSync(path.join(cwd, ".claude")))
		providers.add("anthropic");
	if (fs.existsSync(path.join(cwd, ".cursorrules")) || fs.existsSync(path.join(cwd, ".cursor")))
		providers.add("openai");
	if (
		fs.existsSync(path.join(cwd, ".github", "copilot-instructions.md")) ||
		fs.existsSync(path.join(cwd, ".vscode", "mcp.json"))
	)
		providers.add("openai");
	if (fs.existsSync(path.join(cwd, ".gemini")) || fs.existsSync(path.join(cwd, "AGENTS.md")))
		providers.add("google");
	if (fs.existsSync(path.join(cwd, "codex.toml")) || fs.existsSync(path.join(cwd, ".codex")))
		providers.add("openai");
	if (fs.existsSync(path.join(cwd, ".windsurfrules"))) providers.add("anthropic");

	// MCP server sources → provider
	for (const src of mcpSources) {
		const p = SOURCE_TO_PROVIDER[src];
		if (p) providers.add(p);
	}

	return providers;
}

/** Pick which flagships to show: preferred provider first, then detected providers, fallback to all. */
function pickFlagships(detectedProviders: Set<Provider>, preferredProvider?: Provider): Flagship[] {
	const result: Flagship[] = [];
	const seen = new Set<string>();

	// 1. Preferred provider's flagship always first
	if (preferredProvider) {
		const preferred = ALL_FLAGSHIPS.find((f) => f.provider === preferredProvider);
		if (preferred) {
			result.push(preferred);
			seen.add(preferred.id);
		}
	}

	// 2. Detected provider flagships
	if (detectedProviders.size > 0) {
		for (const f of ALL_FLAGSHIPS) {
			if (!seen.has(f.id) && detectedProviders.has(f.provider)) {
				result.push(f);
				seen.add(f.id);
			}
		}
	}

	// 3. Fallback: show all if nothing was detected
	if (result.length === 0) {
		return [...ALL_FLAGSHIPS];
	}

	return result;
}

// ─── quick scan ─────────────────────────────────────────────────────────────

/**
 * Run a lightweight scan to get headline stats.
 * Returns a single line like: "4,037 tokens/req · Sonnet $1.20 · GPT-5.2 $0.71 per 100 reqs"
 */
async function quickScan(cwd: string): Promise<string> {
	const claudeMdPath = path.join(cwd, "CLAUDE.md");
	const agentsMdPath = path.join(cwd, "AGENTS.md");

	// File footprint
	const rootPath = fs.existsSync(claudeMdPath)
		? claudeMdPath
		: fs.existsSync(agentsMdPath)
			? agentsMdPath
			: null;

	const fp = rootPath ? analyzeContextFootprint(rootPath, cwd) : null;
	const totalTokens = fp?.totalTokens ?? 0;

	// MCP footprint
	const projectLint = await lintProject({ projectDir: cwd });
	const mcpTokens = projectLint.mcpFootprint.totalTokens;
	const mcpSources = projectLint.mcpFootprint.servers.map((s) => s.source);

	// Detect providers & pick flagships
	const config = loadConfig(cwd);
	const detectedProviders = detectProviders(cwd, mcpSources);
	const flagships = pickFlagships(detectedProviders, config.preferredProvider);

	// Cost across flagships (per 100 requests)
	const allTokens = totalTokens + mcpTokens;
	const pricing = getInputPricing();
	const PER = 100;
	const costParts = flagships
		.map(({ id, label }) => {
			const price = pricing[id];
			if (!price) return null;
			const total = computeCostPerReq(allTokens, price) * PER;
			return `${label} ${chalk.bold(fmtCost(total))}`;
		})
		.filter(Boolean)
		.join(chalk.dim("  ·  "));

	return `${chalk.bold(allTokens.toLocaleString())} tokens/req ${chalk.dim("·")} ${costParts}  ${chalk.dim(`per ${PER} reqs`)}`;
}

/**
 * Show the interactive command menu when running in a TTY with no arguments.
 *
 * Runs a quick project scan first to show immediate value, then presents
 * the list of available commands (adapts automatically as plugins register).
 * Returns the selected command name, or null if not applicable.
 */
export async function showInteractiveMenu(program: Command): Promise<string | null> {
	// Only show menu when: no subcommand given AND attached to a terminal
	if (process.argv.length > 2 || !process.stdout.isTTY) {
		return null;
	}

	console.log(chalk.bold.cyan("\n  seeyourai") + chalk.dim(" — See Your AI\n"));

	// Quick scan for headline stats
	try {
		const stats = await quickScan(process.cwd());
		console.log(`  👀 ${stats}\n`);
	} catch {
		// Scan failed (no CLAUDE.md, etc.) — skip the stats line
	}

	const choices = program.commands
		.filter((cmd) => !(cmd as any)._hidden)
		.map((cmd) => ({
			name: `${chalk.bold(cmd.name().padEnd(12))} ${chalk.dim(cmd.description())}`,
			value: cmd.name(),
		}));

	try {
		const choice = await select({
			message: "What would you like to do?",
			choices,
		});
		return choice;
	} catch {
		// User pressed Ctrl+C
		process.exit(0);
	}
}

/**
 * Create and configure the base seeyourai CLI program.
 *
 * Returns an un-parsed Commander program so that cloud plugin packages
 * can call `register(program)` to add their own commands before
 * `program.parse()` is invoked.
 */
export function createProgram(): Command {
	const program = new Command();

	program
		.name("seeyourai")
		.description(
			"See Your AI — Know exactly what your AI agent context costs, per request, per model.",
		)
		.version("0.0.1")
		.addHelpText(
			"after",
			`
Examples:
  $ sya                      Analyze context and show per-request costs
  $ sya context              Same as above
  $ sya context --json       Machine-readable output for CI
  $ sya context --full       Include dynamic session analysis (requires trace data)
  $ sya mcp                  Inspect MCP servers and tools
  $ sya mcp --unused         Find MCP tools that are never invoked

Alias:
  'sya' is an alias for 'seeyourai'. Both work identically.
`,
		);

	// ── eval: context engineering evals ─────────────────────────────────
	registerEvalCommand(program);

	// ── Default action: run context (the core command) ──────────────────
	program.action(async (_, cmd) => {
		// Forward to the context subcommand so `sya` and `sya context` behave identically
		await cmd.parseAsync(["context", ...process.argv.slice(2)], { from: "user" });
	});

	// ── context: read-only audit (show context footprint, token counts, costs) ──
	program
		.command("context")
		.description("Show context footprint, token counts, and per-request costs")
		.option("--json", "Output results as JSON (for CI/scripting)")
		.option("--full", "Include dynamic session analysis (requires trace data)")
		.option("-s, --session <id>", "Analyze usage for a specific session by ID (implies --full)")
		.option("--all", "Analyze usage across all stored sessions (implies --full)")
		.option("--min-tokens <number>", "Minimum file token size to report (default: 100)")
		.option("--list", "List available sessions for usage analysis")
		.option("--update-baseline", "Write current results to seeyourai-baseline.yaml")
		.action(async (options) => {
			try {
				const full = options.full || !!options.session || !!options.all;
				await contextCommand({
					json: options.json,
					session: options.session,
					all: options.all,
					minTokens: options.minTokens ? Number(options.minTokens) : undefined,
					list: options.list,
					updateBaseline: options.updateBaseline,
					static: !full,
				});
			} catch (error) {
				console.error(chalk.red(`Error: ${error}`));
				process.exit(1);
			}
		});

	// ── mcp: MCP server & tool inspector ────────────────────────────────
	program
		.command("mcp")
		.description("Inspect MCP servers, tools, and token footprints")
		.option("--json", "Output results as JSON")
		.option("--live", "Live-ping MCP servers for accurate tool counts")
		.option("--source <source>", "Filter by source (e.g. claude-code, cursor)")
		.option("--diff", "Compare current MCP tools against saved baseline")
		.option("--unused", "Cross-reference with traces to find never-invoked tools")
		.option("--export <format>", "Export MCP tool surface (format: openapi)")
		.action(async (options) => {
			try {
				await mcpCommand({
					json: options.json,
					live: options.live,
					source: options.source,
					diff: options.diff,
					unused: options.unused,
					export: options.export,
				});
			} catch (error) {
				console.error(chalk.red(`Error: ${error}`));
				process.exit(1);
			}
		});

	return program;
}
