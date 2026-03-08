/**
 * OpenAPI 3.1 spec generator from MCP tool schemas.
 * Inlined from @seeyourai/core for the OSS CLI.
 */

interface CapabilityEntry {
	id: string;
	name: string;
	source: string;
	tokens: number;
	kind: "group" | "tool";
	parentId?: string;
	scope: "user" | "project";
	description?: string;
	inputSchema?: Record<string, unknown>;
}

interface CapabilitySummaryInput {
	capabilities: CapabilityEntry[];
	totalTokens: number;
	totalCapabilities: number;
	bySource: Record<string, { count: number; tokens: number }>;
}

interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		description: string;
		version: string;
	};
	paths: Record<string, PathItem>;
	tags?: Array<{ name: string; description: string }>;
	components?: {
		schemas?: Record<string, unknown>;
	};
}

interface PathItem {
	post: {
		summary: string;
		description?: string;
		operationId: string;
		tags: string[];
		requestBody?: {
			required: boolean;
			content: {
				"application/json": {
					schema: Record<string, unknown>;
				};
			};
		};
		responses: Record<
			string,
			{
				description: string;
			}
		>;
	};
}

export function generateOpenAPISpec(summary: CapabilitySummaryInput): OpenAPISpec {
	const paths: Record<string, PathItem> = {};
	const groups = summary.capabilities.filter((c) => c.kind === "group");
	const tools = summary.capabilities.filter((c) => c.kind === "tool");

	for (const tool of tools) {
		const serverName = tool.parentId?.replace(/^(mcp|skill):/, "") || "unknown";
		const pathKey = `/tools/${encodeURIComponent(serverName)}/${encodeURIComponent(tool.name)}`;

		const operationId = `${serverName}_${tool.name}`.replace(/[^a-zA-Z0-9_]/g, "_");

		const pathItem: PathItem = {
			post: {
				summary: tool.description || `Invoke ${tool.name}`,
				operationId,
				tags: [serverName],
				responses: {
					"200": { description: "Tool execution result" },
					"400": { description: "Invalid parameters" },
				},
			},
		};

		if (tool.description) {
			pathItem.post.description = `MCP tool from ${serverName}. ${tool.description}`;
		}

		if (tool.inputSchema && Object.keys(tool.inputSchema).length > 0) {
			pathItem.post.requestBody = {
				required: true,
				content: {
					"application/json": {
						schema: tool.inputSchema,
					},
				},
			};
		}

		paths[pathKey] = pathItem;
	}

	const tags = groups
		.filter((g) => tools.some((t) => t.parentId === g.id))
		.map((g) => ({
			name: g.name,
			description: g.description || `MCP server: ${g.name} (${g.source})`,
		}));

	return {
		openapi: "3.1.0",
		info: {
			title: "Agent MCP Tool Surface",
			description: `Auto-generated from ${tools.length} MCP tools across ${groups.length} servers. Total token footprint: ${summary.totalTokens.toLocaleString()} tokens.`,
			version: "1.0.0",
		},
		paths,
		...(tags.length > 0 ? { tags } : {}),
	};
}
