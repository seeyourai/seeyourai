/**
 * MCP server detection and analysis.
 * Inlined from @seeyourai/core for the OSS CLI.
 *
 * Scans user-level AND project-level configs for all supported tools:
 *   Claude Code, Claude Desktop, Cursor, Windsurf, Firebender, Antigravity,
 *   Cline, Goose, VS Code / GitHub Copilot, Kiro, Amazon Q, OpenAI Codex
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { MCPContextStats } from "./types.js";

export interface MCPServerConfig {
	name: string;
	source:
		| "claude-desktop"
		| "claude-code"
		| "cursor"
		| "windsurf"
		| "firebender"
		| "antigravity"
		| "vscode"
		| "kiro"
		| "amazon-q"
		| "codex"
		| "goose"
		| "cline"
		| "custom";
	scope: "user" | "project";
	transport: "stdio" | "http" | "sse";
	command: string;
	args: string[];
	url?: string;
	env?: Record<string, string>;
	headers?: Record<string, string>;
	toolCount?: number;
}

interface MCPToolDetail {
	name: string;
	description?: string;
	estimatedTokens: number;
	inputSchema?: Record<string, unknown>;
}

export interface MCPOptions {
	livePing?: boolean;
	pingTimeoutMs?: number;
	ignoreServers?: string[];
	projectDir?: string;
}

function estimateToolTokens(tool: {
	name: string;
	description?: string;
	inputSchema?: any;
}): number {
	let tokens = 5;
	if (tool.description) tokens += Math.ceil(tool.description.length / 4);
	if (tool.inputSchema) tokens += Math.ceil(JSON.stringify(tool.inputSchema).length / 4);
	return tokens;
}

/**
 * Summarize a JSON Schema into a compact human-readable string.
 * Example: "query: string, limit?: number, verbose?: boolean"
 */
export function summarizeJsonSchema(
	schema?: Record<string, unknown>,
	maxParams = 5,
): string | null {
	if (!schema) return null;
	const properties = schema.properties as Record<string, any> | undefined;
	if (!properties || Object.keys(properties).length === 0) return null;

	const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);

	const entries = Object.entries(properties);
	const shown = entries.slice(0, maxParams);
	const parts: string[] = [];
	for (const [name, prop] of shown) {
		const type = typeof prop?.type === "string" ? prop.type : "any";
		if (required.has(name)) {
			parts.push(`${name}: ${type}`);
		} else {
			parts.push(`${name}?: ${type}`);
		}
	}

	if (entries.length > maxParams) {
		parts.push(`+${entries.length - maxParams} more`);
	}

	return parts.length > 0 ? parts.join(", ") : null;
}

async function fetchMCPTools(
	config: MCPServerConfig,
	timeoutMs = 5000,
): Promise<Array<{ name: string; description?: string; inputSchema?: any }>> {
	return new Promise((resolve, reject) => {
		const child = spawn(config.command, config.args, {
			env: { ...process.env, ...config.env },
			stdio: ["pipe", "pipe", "inherit"],
		});

		const timeout = setTimeout(() => {
			child.kill();
			reject(new Error("Timeout waiting for MCP server response"));
		}, timeoutMs);

		let buffer = "";
		child.stdout.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			try {
				const lines = buffer.split("\n");
				for (const line of lines) {
					if (line.trim().startsWith("{") && line.includes('"result"')) {
						const response = JSON.parse(line);
						if (response.result?.tools) {
							clearTimeout(timeout);
							child.kill();
							resolve(response.result.tools);
							return;
						}
					}
				}
			} catch (_e) {
				// Not a full JSON yet, continue buffering
			}
		});

		child.on("error", (err: Error) => {
			clearTimeout(timeout);
			reject(err);
		});

		const request = {
			jsonrpc: "2.0",
			method: "tools/list",
			id: 1,
			params: {},
		};
		child.stdin.write(`${JSON.stringify(request)}\n`);
	});
}

// ── Cross-platform config path helpers ──────────────────────────────────

function appDataDir(): string {
	const platform = os.platform();
	if (platform === "darwin") {
		return path.join(os.homedir(), "Library", "Application Support");
	}
	if (platform === "win32") {
		return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
	}
	return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

// ── Main analysis entry point ───────────────────────────────────────────

export async function detectAndAnalyzeMCP(
	usedTools?: Map<string, Set<string>>,
	options: MCPOptions = {},
): Promise<MCPContextStats> {
	const livePing = options.livePing ?? false;
	const pingTimeoutMs = options.pingTimeoutMs ?? 5000;
	const ignoreServers = new Set(options.ignoreServers || []);

	const allConfigs = detectMCPServers(options.projectDir);
	const configs = allConfigs.filter((c) => !ignoreServers.has(c.name));

	const servers: MCPContextStats["servers"] = [];
	let totalTools = 0;

	for (const config of configs) {
		let toolCount = 5;
		let toolDetails: MCPToolDetail[] = [];

		if (livePing && config.command !== "unknown") {
			try {
				const tools = await fetchMCPTools(config, pingTimeoutMs);
				if (tools && Array.isArray(tools)) {
					toolCount = tools.length;
					toolDetails = tools.map((t) => ({
						name: t.name || "unknown",
						description: t.description,
						estimatedTokens: estimateToolTokens(t),
						inputSchema: t.inputSchema as Record<string, unknown> | undefined,
					}));
				}
			} catch (_e) {
				toolCount = heuristicToolCount(config.name);
			}
		} else {
			toolCount = heuristicToolCount(config.name);
		}

		const toolsUsed = usedTools?.get(config.name)?.size || 0;
		const tokenImpact =
			toolDetails.length > 0
				? toolDetails.reduce((sum, t) => sum + t.estimatedTokens, 0)
				: estimateMCPTokenImpact(toolCount);

		servers.push({
			name: config.name,
			source: config.source,
			scope: config.scope,
			toolCount,
			tokenImpact,
			toolsUsed,
			tools: toolDetails,
		});

		totalTools += toolCount;
	}

	const totalTokenImpact = servers.reduce((sum, s) => sum + s.tokenImpact, 0);

	return {
		totalServers: servers.length,
		totalTools,
		totalTokenImpact,
		servers,
	};
}

function heuristicToolCount(serverName: string): number {
	const name = serverName.toLowerCase();
	if (name.includes("filesystem") || name.includes("file")) return 10;
	if (name.includes("github")) return 15;
	if (name.includes("google") || name.includes("gdrive")) return 12;
	if (name.includes("postgres") || name.includes("db") || name.includes("sqlite")) return 8;
	if (name.includes("brave") || name.includes("search")) return 3;
	if (name.includes("slack") || name.includes("discord")) return 10;
	return 5;
}

// ── Server detection ────────────────────────────────────────────────────

export function detectMCPServers(projectDir?: string): MCPServerConfig[] {
	const servers: MCPServerConfig[] = [];
	const seen = new Set<string>();

	function addServer(config: MCPServerConfig): void {
		const key = `${config.source}:${config.name}`;
		if (!seen.has(key)) {
			seen.add(key);
			servers.push(config);
		}
	}

	// 1. Claude Code
	parseClaudeCodeConfig(path.join(os.homedir(), ".claude", "settings.json"), "user", addServer);
	if (projectDir) {
		parseClaudeCodeConfig(path.join(projectDir, ".claude", "settings.json"), "project", addServer);
		parseClaudeCodeConfig(
			path.join(projectDir, ".claude", "settings.local.json"),
			"project",
			addServer,
		);
	}

	// 2. Claude Desktop
	const claudeDesktopPath = path.join(appDataDir(), "Claude", "claude_desktop_config.json");
	parseMcpServersJson(claudeDesktopPath, "claude-desktop", "user", addServer);

	// 3. Cursor
	parseMcpServersJson(path.join(os.homedir(), ".cursor", "mcp.json"), "cursor", "user", addServer);
	if (projectDir) {
		parseMcpServersJson(
			path.join(projectDir, ".cursor", "mcp.json"),
			"cursor",
			"project",
			addServer,
		);
	}

	// 4. Windsurf / Codeium
	parseMcpServersJson(
		path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
		"windsurf",
		"user",
		addServer,
	);

	// 5. Firebender
	parseFirebenderConfig(
		path.join(os.homedir(), ".firebender", "firebender.json"),
		"user",
		addServer,
	);
	if (projectDir) {
		parseFirebenderConfig(path.join(projectDir, "firebender.json"), "project", addServer);
	}

	// 6. Antigravity (Google)
	parseMcpServersJson(
		path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json"),
		"antigravity",
		"user",
		addServer,
	);

	// 7. Cline / VS Code
	const clinePath = path.join(
		appDataDir(),
		"Code",
		"User",
		"globalStorage",
		"saoudrizwan.claude-dev",
		"settings",
		"cline_mcp_settings.json",
	);
	parseMcpServersJson(clinePath, "cline", "user", addServer);

	// 8. Goose
	parseGooseConfig(path.join(os.homedir(), ".config", "goose", "config.yaml"), addServer);

	// 9. VS Code / GitHub Copilot
	parseMcpServersJson(
		path.join(appDataDir(), "Code", "User", "mcp.json"),
		"vscode",
		"user",
		addServer,
	);
	if (projectDir) {
		parseMcpServersJson(
			path.join(projectDir, ".vscode", "mcp.json"),
			"vscode",
			"project",
			addServer,
		);
	}

	// 10. Kiro
	parseMcpServersJson(
		path.join(os.homedir(), ".kiro", "settings", "mcp.json"),
		"kiro",
		"user",
		addServer,
	);
	if (projectDir) {
		parseMcpServersJson(
			path.join(projectDir, ".kiro", "settings", "mcp.json"),
			"kiro",
			"project",
			addServer,
		);
	}

	// 11. Amazon Q
	parseMcpServersJson(
		path.join(os.homedir(), ".aws", "amazonq", "mcp.json"),
		"amazon-q",
		"user",
		addServer,
	);
	parseMcpServersJson(
		path.join(os.homedir(), ".aws", "amazonq", "default.json"),
		"amazon-q",
		"user",
		addServer,
	);
	if (projectDir) {
		parseMcpServersJson(
			path.join(projectDir, ".amazonq", "mcp.json"),
			"amazon-q",
			"project",
			addServer,
		);
		parseMcpServersJson(
			path.join(projectDir, ".amazonq", "default.json"),
			"amazon-q",
			"project",
			addServer,
		);
	}

	// 12. OpenAI Codex
	parseCodexToml(path.join(os.homedir(), ".codex", "config.toml"), "user", addServer);
	if (projectDir) {
		parseCodexToml(path.join(projectDir, "codex.toml"), "project", addServer);
		parseCodexToml(path.join(projectDir, ".codex", "config.toml"), "project", addServer);
	}

	return servers;
}

// ── Config file parsers ─────────────────────────────────────────────────

function parseClaudeCodeConfig(
	filePath: string,
	scope: "user" | "project",
	addServer: (config: MCPServerConfig) => void,
): void {
	if (!fs.existsSync(filePath)) return;
	try {
		const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		if (config.mcpServers && typeof config.mcpServers === "object") {
			for (const [name, server] of Object.entries(config.mcpServers)) {
				addServer(normalizeServerEntry(name, server, "claude-code", scope));
			}
		}
	} catch (_e) {
		// Ignore parse errors
	}
}

function parseMcpServersJson(
	filePath: string,
	source: MCPServerConfig["source"],
	scope: "user" | "project",
	addServer: (config: MCPServerConfig) => void,
): void {
	if (!fs.existsSync(filePath)) return;
	try {
		const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		const serverMap = config.mcpServers ?? config.servers;
		if (serverMap && typeof serverMap === "object") {
			for (const [name, server] of Object.entries(serverMap)) {
				addServer(normalizeServerEntry(name, server, source, scope));
			}
		}
	} catch (_e) {
		// Ignore parse errors
	}
}

function normalizeServerEntry(
	name: string,
	s: any,
	source: MCPServerConfig["source"],
	scope: "user" | "project",
): MCPServerConfig {
	const hasUrl = typeof s.url === "string" && s.url.length > 0;
	const explicitType = s.type?.toLowerCase();

	let transport: MCPServerConfig["transport"] = "stdio";
	if (explicitType === "http" || explicitType === "sse") {
		transport = explicitType;
	} else if (hasUrl && !s.command) {
		transport = "http";
	}

	return {
		name,
		source,
		scope,
		transport,
		command: s.command || "unknown",
		args: s.args || [],
		...(hasUrl ? { url: s.url } : {}),
		...(s.env ? { env: s.env } : {}),
		...(s.headers ? { headers: s.headers } : {}),
	};
}

function parseFirebenderConfig(
	filePath: string,
	scope: "user" | "project",
	addServer: (config: MCPServerConfig) => void,
): void {
	if (!fs.existsSync(filePath)) return;
	try {
		const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		if (config.mcpServers && typeof config.mcpServers === "object") {
			for (const [name, server] of Object.entries(config.mcpServers)) {
				addServer(normalizeServerEntry(name, server, "firebender", scope));
			}
		}
	} catch (_e) {
		// Ignore parse errors
	}
}

function parseGooseConfig(filePath: string, addServer: (config: MCPServerConfig) => void): void {
	if (!fs.existsSync(filePath)) return;
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		if (content.includes("extensions:")) {
			const lines = content.split("\n");
			let inExtensions = false;
			for (const line of lines) {
				if (line.trim().startsWith("extensions:")) {
					inExtensions = true;
					continue;
				}
				if (inExtensions && line.trim() === "") {
					inExtensions = false;
				}
				if (inExtensions && line.includes("name:")) {
					const nameMatch = line.match(/name:\s*(.+)/);
					if (nameMatch) {
						addServer({
							name: nameMatch[1].trim(),
							source: "goose",
							scope: "user",
							transport: "stdio",
							command: "unknown",
							args: [],
						});
					}
				}
			}
		}
	} catch (_e) {
		// Ignore
	}
}

function parseCodexToml(
	filePath: string,
	scope: "user" | "project",
	addServer: (config: MCPServerConfig) => void,
): void {
	if (!fs.existsSync(filePath)) return;
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const serverRegex = /\[mcp_servers\.([^\]]+)\]/g;
		const matches = Array.from(content.matchAll(serverRegex));

		for (const match of matches) {
			const serverName = match[1].trim().replace(/^"|"$/g, "");
			const sectionStart = content.indexOf(match[0]);
			const afterHeader = content.substring(sectionStart + match[0].length);

			const nextSection = afterHeader.search(/^\[/m);
			const sectionBody = nextSection >= 0 ? afterHeader.substring(0, nextSection) : afterHeader;

			const command = extractTomlString(sectionBody, "command") || "unknown";
			const args = extractTomlArray(sectionBody, "args");
			const env = extractTomlInlineTable(sectionBody, "env");
			const url = extractTomlString(sectionBody, "url");
			const headers = extractTomlInlineTable(sectionBody, "http_headers");

			const hasUrl = typeof url === "string" && url.length > 0;
			const transport: MCPServerConfig["transport"] =
				hasUrl && command === "unknown" ? "http" : "stdio";

			addServer({
				name: serverName,
				source: "codex",
				scope,
				transport,
				command,
				args,
				...(hasUrl ? { url } : {}),
				...(env && Object.keys(env).length > 0 ? { env } : {}),
				...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
			});
		}
	} catch (_e) {
		// Ignore parse errors
	}
}

function extractTomlString(body: string, key: string): string | undefined {
	const regex = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m");
	const m = body.match(regex);
	return m ? m[1] : undefined;
}

function extractTomlArray(body: string, key: string): string[] {
	const regex = new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m");
	const m = body.match(regex);
	if (!m) return [];
	return m[1]
		.split(",")
		.map((s) => s.trim().replace(/^"|"$/g, ""))
		.filter((s) => s.length > 0);
}

function extractTomlInlineTable(body: string, key: string): Record<string, string> | undefined {
	const regex = new RegExp(`^\\s*${key}\\s*=\\s*\\{([^}]*)\\}`, "m");
	const m = body.match(regex);
	if (!m) return undefined;
	const result: Record<string, string> = {};
	const pairs = m[1].split(",");
	for (const pair of pairs) {
		const eqIdx = pair.indexOf("=");
		if (eqIdx > 0) {
			const k = pair.substring(0, eqIdx).trim();
			const v = pair
				.substring(eqIdx + 1)
				.trim()
				.replace(/^"|"$/g, "");
			if (k && v) result[k] = v;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

// ── Token estimation ────────────────────────────────────────────────────

export function estimateMCPTokenImpact(toolCount: number): number {
	return toolCount * 250;
}
