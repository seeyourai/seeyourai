/**
 * Capabilities Analyzer.
 * Inlined from @seeyourai/lint-rules for the OSS CLI.
 *
 * Merges MCP server tools and local .agents/skills/ into a unified
 * capability inventory.
 */

import { detectAndAnalyzeMCP, type MCPOptions } from "./mcp-detector.js";
import { analyzeSkillFootprint } from "./skill-footprint.js";

export type CapabilitySource = string;

export interface Capability {
	id: string;
	name: string;
	source: CapabilitySource;
	tokens: number;
	kind: "group" | "tool";
	parentId?: string;
	scope: "user" | "project";
	description?: string;
	inputSchema?: Record<string, unknown>;
}

export interface CapabilitySummary {
	capabilities: Capability[];
	totalTokens: number;
	totalCapabilities: number;
	bySource: Record<string, { count: number; tokens: number }>;
}

export interface CapabilityAnalysisOptions {
	livePing?: boolean;
	pingTimeoutMs?: number;
	ignoreServers?: string[];
}

export async function analyzeCapabilities(
	projectRoot: string,
	options: CapabilityAnalysisOptions = {},
): Promise<CapabilitySummary> {
	const capabilities: Capability[] = [];

	// 1. MCP servers and their tools
	const mcpOptions: MCPOptions = {
		livePing: options.livePing ?? false,
		pingTimeoutMs: options.pingTimeoutMs,
		ignoreServers: options.ignoreServers,
		projectDir: projectRoot,
	};

	try {
		const mcpStats = await detectAndAnalyzeMCP(undefined, mcpOptions);

		for (const server of mcpStats.servers) {
			const groupId = `mcp:${server.name}`;

			capabilities.push({
				id: groupId,
				name: server.name,
				source: server.source,
				tokens: server.tokenImpact,
				kind: "group",
				scope: server.scope,
			});

			for (const tool of server.tools) {
				capabilities.push({
					id: `mcp:${server.name}:${tool.name}`,
					name: tool.name,
					source: server.source,
					tokens: tool.estimatedTokens,
					kind: "tool",
					parentId: groupId,
					scope: server.scope,
					description: tool.description,
					inputSchema: tool.inputSchema,
				});
			}
		}
	} catch {
		// MCP detection failure is non-fatal
	}

	// 2. Local skills
	const skillFootprint = analyzeSkillFootprint(projectRoot);

	for (const skill of skillFootprint.skills) {
		capabilities.push({
			id: `skill:${skill.name}`,
			name: skill.frontmatter.name || skill.name,
			source: "local-skill",
			tokens: skill.tokens,
			kind: "group",
			scope: "project",
			description: skill.frontmatter.description,
		});
	}

	// 3. Aggregate by source
	const bySource: Record<string, { count: number; tokens: number }> = {};
	for (const cap of capabilities) {
		if (cap.kind !== "group") continue;
		if (!bySource[cap.source]) {
			bySource[cap.source] = { count: 0, tokens: 0 };
		}
		bySource[cap.source].count++;
		bySource[cap.source].tokens += cap.tokens;
	}

	const groups = capabilities.filter((c) => c.kind === "group");
	const totalTokens = groups.reduce((sum, c) => sum + c.tokens, 0);

	return {
		capabilities,
		totalTokens,
		totalCapabilities: groups.length,
		bySource,
	};
}
