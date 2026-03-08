import chalk from "chalk";
import { analyzeCapabilities, type CapabilitySummary } from "../internal/capabilities-analyzer.js";
import { summarizeJsonSchema } from "../internal/mcp-detector.js";
import { generateOpenAPISpec } from "../internal/openapi-export.js";

interface McpOptions {
	json?: boolean;
	live?: boolean;
	source?: string;
	export?: string;
}

/**
 * MCP server & tool inspector.
 *
 * Lists all MCP servers and tools with token footprints, grouped by source.
 */
export async function mcpCommand(options: McpOptions = {}): Promise<CapabilitySummary> {
	const cwd = process.cwd();
	const summary = await analyzeCapabilities(cwd, {
		livePing: options.live ?? false,
	});

	// ── --export openapi: generate OpenAPI spec ───────────────────────
	if (options.export === "openapi") {
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
