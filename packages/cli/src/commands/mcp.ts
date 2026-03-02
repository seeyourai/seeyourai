import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FileStorage, summarizeJsonSchema } from "@seeya/core";
import { analyzeCapabilities, type Capability, type CapabilitySummary } from "@seeya/lint-rules";
import chalk from "chalk";

interface McpOptions {
	json?: boolean;
	live?: boolean;
	source?: string;
	diff?: boolean;
	unused?: boolean;
	export?: string;
}

/**
 * Diff result for --diff flag
 */
interface CapabilityDiff {
	added: Array<{ name: string; source: string; tokens: number; kind: string }>;
	removed: Array<{ name: string; source: string; tokens: number; kind: string }>;
	tokenDelta: number;
	baselineTokens: number;
	currentTokens: number;
}

/**
 * MCP server & tool inspector.
 *
 * Lists all MCP servers and tools with token footprints, grouped by source.
 */
export async function mcpCommand(
	options: McpOptions = {},
): Promise<CapabilitySummary | CapabilityDiff> {
	const cwd = process.cwd();
	const summary = await analyzeCapabilities(cwd, {
		livePing: options.live ?? false,
	});

	// ── --diff: compare against baseline ──────────────────────────────
	if (options.diff) {
		return runDiff(cwd, summary, options.json ?? false);
	}

	// ── --unused: cross-reference with traces ─────────────────────────
	if (options.unused) {
		return runUnused(cwd, summary, options.json ?? false);
	}

	// ── --export openapi: generate OpenAPI spec ───────────────────────
	if (options.export === "openapi") {
		const { generateOpenAPISpec } = await import("@seeya/core");
		const spec = generateOpenAPISpec(summary);
		process.stdout.write(`${JSON.stringify(spec, null, 2)}\n`);
		return summary;
	}

	if (options.json) {
		const output = options.source ? filterBySource(summary, options.source) : summary;
		process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
		return output;
	}

	console.log(chalk.bold.cyan("\n  sya mcp\n"));

	const filtered = options.source ? filterBySource(summary, options.source) : summary;
	const groups = filtered.capabilities.filter((c) => c.kind === "group");

	if (groups.length === 0) {
		console.log(chalk.gray("  No MCP servers detected.\n"));
		return filtered;
	}

	console.log(
		chalk.gray(
			`  ${chalk.white(filtered.totalCapabilities.toString())} servers · ${chalk.white(filtered.totalTokens.toLocaleString())} tokens\n`,
		),
	);

	// Group by source
	for (const [source, stats] of Object.entries(filtered.bySource)) {
		console.log(
			`  ${chalk.bold(source)} ${chalk.dim(`(${stats.count} · ${stats.tokens.toLocaleString()} tokens)`)}`,
		);

		const sourceGroups = groups.filter((c) => c.source === source);
		for (const group of sourceGroups) {
			const tokLabel =
				group.tokens >= 1000 ? `${(group.tokens / 1000).toFixed(1)}k` : `${group.tokens}`;
			const scopeTag = group.scope === "project" ? chalk.cyan("[project]") : chalk.gray("[user]");
			const desc = group.description ? chalk.dim(` — ${group.description}`) : "";
			console.log(
				`    ${chalk.gray("-")} ${chalk.white(group.name.padEnd(28))} ${chalk.dim(`~${tokLabel} tok`)}  ${scopeTag}${desc}`,
			);

			// Show child tools if available
			const tools = filtered.capabilities.filter(
				(c) => c.kind === "tool" && c.parentId === group.id,
			);
			if (tools.length > 0) {
				for (const tool of tools.slice(0, 5)) {
					const paramSummary = summarizeJsonSchema(tool.inputSchema);
					const paramStr = paramSummary ? chalk.dim(` (${paramSummary})`) : "";
					console.log(
						`      ${chalk.dim("·")} ${chalk.dim(tool.name.padEnd(30))} ${chalk.dim(`~${tool.tokens} tok`)}${paramStr}`,
					);
				}
				if (tools.length > 5) {
					console.log(chalk.dim(`      ...and ${tools.length - 5} more tools`));
				}
			}
		}
		console.log();
	}

	return filtered;
}

// ── --diff implementation ─────────────────────────────────────────────

async function runDiff(
	cwd: string,
	current: CapabilitySummary,
	json: boolean,
): Promise<CapabilityDiff> {
	const baselinePath = path.join(cwd, "seeyourai-baseline.yaml");

	if (!fs.existsSync(baselinePath)) {
		if (!json) {
			console.log(chalk.red("\n  No baseline found."));
			console.log(
				chalk.gray("  Run `sya context --update-baseline` to create seeyourai-baseline.yaml\n"),
			);
		}
		return {
			added: [],
			removed: [],
			tokenDelta: 0,
			baselineTokens: 0,
			currentTokens: current.totalTokens,
		};
	}

	const { load: yamlLoad } = await import("js-yaml");
	const baselineRaw = fs.readFileSync(baselinePath, "utf-8");
	const baseline = yamlLoad(baselineRaw) as any;

	// Extract baseline MCP servers from the static.mcp section
	const baselineServers: Map<string, { tokens: number; toolCount: number }> = new Map();
	const baselineTools: Set<string> = new Set();
	let baselineTokens = 0;

	if (baseline?.static?.mcp?.servers) {
		for (const server of baseline.static.mcp.servers) {
			baselineServers.set(server.name, {
				tokens: server.tokenImpact || 0,
				toolCount: server.toolCount || 0,
			});
			baselineTokens += server.tokenImpact || 0;
			if (server.tools) {
				for (const tool of server.tools) {
					baselineTools.add(`${server.name}:${tool.name}`);
				}
			}
		}
	}

	// Build current capability set
	const currentGroups = new Map<string, Capability>();
	const currentTools = new Set<string>();
	for (const cap of current.capabilities) {
		if (cap.kind === "group") {
			currentGroups.set(cap.name, cap);
		} else if (cap.kind === "tool" && cap.parentId) {
			const serverName = cap.parentId.replace(/^mcp:/, "");
			currentTools.add(`${serverName}:${cap.name}`);
		}
	}

	// Compute diff
	const added: CapabilityDiff["added"] = [];
	const removed: CapabilityDiff["removed"] = [];

	for (const cap of current.capabilities) {
		if (cap.kind === "group" && !baselineServers.has(cap.name)) {
			added.push({ name: cap.name, source: cap.source, tokens: cap.tokens, kind: "server" });
		}
	}

	for (const [name, info] of baselineServers) {
		if (!currentGroups.has(name)) {
			removed.push({ name, source: "baseline", tokens: info.tokens, kind: "server" });
		}
	}

	const tokenDelta = current.totalTokens - baselineTokens;
	const diff: CapabilityDiff = {
		added,
		removed,
		tokenDelta,
		baselineTokens,
		currentTokens: current.totalTokens,
	};

	if (json) {
		process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
		return diff;
	}

	console.log(chalk.bold.cyan("\n  sya mcp --diff\n"));

	const deltaStr =
		tokenDelta > 0
			? chalk.red(`+${tokenDelta.toLocaleString()}`)
			: tokenDelta < 0
				? chalk.green(`${tokenDelta.toLocaleString()}`)
				: chalk.gray("0");

	console.log(
		`  Baseline: ${chalk.white(baselineTokens.toLocaleString())} tokens → Current: ${chalk.white(current.totalTokens.toLocaleString())} tokens (${deltaStr} tokens)\n`,
	);

	if (added.length > 0) {
		console.log(chalk.green(`  Added (${added.length}):`));
		for (const item of added) {
			console.log(
				`    ${chalk.green("+")} ${chalk.white(item.name.padEnd(28))} ${chalk.dim(`~${item.tokens.toLocaleString()} tok`)}  ${chalk.dim(`(${item.source})`)}`,
			);
		}
		console.log();
	}

	if (removed.length > 0) {
		console.log(chalk.red(`  Removed (${removed.length}):`));
		for (const item of removed) {
			console.log(
				`    ${chalk.red("-")} ${chalk.white(item.name.padEnd(28))} ${chalk.dim(`~${item.tokens.toLocaleString()} tok`)}`,
			);
		}
		console.log();
	}

	if (added.length === 0 && removed.length === 0) {
		console.log(chalk.green("  No MCP drift detected.\n"));
	}

	// CI exit code: non-zero if capabilities drifted
	if (added.length > 0 || removed.length > 0) {
		console.log(
			chalk.dim(
				"  Tip: Update baseline with `sya context --update-baseline` if this change is intentional.\n",
			),
		);
	}

	return diff;
}

// ── --unused implementation ───────────────────────────────────────────

async function runUnused(
	_cwd: string,
	summary: CapabilitySummary,
	json: boolean,
): Promise<CapabilitySummary> {
	const storagePath = path.join(os.homedir(), ".seeyourai", "events.jsonl");
	if (!fs.existsSync(storagePath)) {
		if (!json) {
			console.log(chalk.yellow("\n  No trace data found at ~/.seeyourai/events.jsonl"));
			console.log(chalk.gray("  Run your agent with seeyourai tracing to collect usage data.\n"));
		}
		return summary;
	}

	const storage = new FileStorage(storagePath);
	await storage.reload();
	const sessions = await storage.getSessionIndex();

	if (sessions.length === 0) {
		if (!json) {
			console.log(chalk.yellow("\n  No sessions found in trace data.\n"));
		}
		return summary;
	}

	// Aggregate tool invocations across recent sessions (up to 10)
	const recentSessions = [...sessions]
		.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
		.slice(0, 10);

	const invokedTools = new Set<string>();

	for (const session of recentSessions) {
		const events = await storage.getBySession(session.id);
		for (const event of events) {
			if (event.eventType === "tool_call") {
				const payload = event.payload as any;
				const name = payload.name || payload.mcpToolName;
				if (name) invokedTools.add(name);
			}
		}
	}

	// Cross-reference: find tools in capabilities that were never invoked
	const tools = summary.capabilities.filter((c) => c.kind === "tool");
	const unusedTools = tools.filter((t) => !invokedTools.has(t.name));
	const usedTools = tools.filter((t) => invokedTools.has(t.name));
	const wastedTokens = unusedTools.reduce((sum, t) => sum + t.tokens, 0);

	if (json) {
		process.stdout.write(
			`${JSON.stringify(
				{
					sessionsAnalyzed: recentSessions.length,
					totalTools: tools.length,
					usedTools: usedTools.length,
					unusedTools: unusedTools.map((t) => ({
						name: t.name,
						source: t.source,
						tokens: t.tokens,
						parentId: t.parentId,
					})),
					wastedTokensPerRequest: wastedTokens,
				},
				null,
				2,
			)}\n`,
		);
		return summary;
	}

	console.log(chalk.bold.cyan("\n  sya mcp --unused\n"));
	console.log(
		chalk.gray(
			`  Cross-referenced ${chalk.white(tools.length.toString())} tool definitions against ${chalk.white(recentSessions.length.toString())} recent sessions\n`,
		),
	);

	if (unusedTools.length === 0) {
		console.log(chalk.green("  All defined tools were invoked at least once.\n"));
		return summary;
	}

	console.log(
		chalk.yellow(
			`  ${unusedTools.length} tools never invoked (~${wastedTokens.toLocaleString()} tokens wasted per request):\n`,
		),
	);

	// Group unused tools by parent (server)
	const byParent = new Map<string, typeof unusedTools>();
	for (const tool of unusedTools) {
		const parent = tool.parentId || "unknown";
		if (!byParent.has(parent)) byParent.set(parent, []);
		byParent.get(parent)?.push(tool);
	}

	for (const [parentId, parentTools] of byParent) {
		const serverName = parentId.replace(/^mcp:/, "");
		const parentTokens = parentTools.reduce((s, t) => s + t.tokens, 0);
		console.log(
			`  ${chalk.white(serverName)} ${chalk.dim(`(${parentTools.length} unused · ~${parentTokens.toLocaleString()} tok)`)}`,
		);
		for (const tool of parentTools.slice(0, 8)) {
			console.log(
				`    ${chalk.gray("-")} ${chalk.dim(tool.name.padEnd(30))} ${chalk.dim(`~${tool.tokens} tok`)}`,
			);
		}
		if (parentTools.length > 8) {
			console.log(chalk.dim(`    ...and ${parentTools.length - 8} more`));
		}
	}

	console.log(
		chalk.dim(
			`\n  Suggestion: Remove unused tools to save ~${wastedTokens.toLocaleString()} tokens/request.\n`,
		),
	);

	return summary;
}

// ── helpers ───────────────────────────────────────────────────────────

function filterBySource(summary: CapabilitySummary, source: string): CapabilitySummary {
	const capabilities = summary.capabilities.filter((c) => c.source === source);
	const groups = capabilities.filter((c) => c.kind === "group");
	const totalTokens = groups.reduce((sum, c) => sum + c.tokens, 0);
	const bySource: Record<string, { count: number; tokens: number }> = {};
	if (summary.bySource[source]) {
		bySource[source] = summary.bySource[source];
	}
	return {
		capabilities,
		totalTokens,
		totalCapabilities: groups.length,
		bySource,
	};
}
