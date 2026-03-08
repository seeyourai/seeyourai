/**
 * Shared types for the OSS CLI.
 * Inlined from @seeyourai/core, @seeyourai/lint-rules, and @seeyourai/shared-types
 * to make the OSS package self-contained.
 */

// ── Lint types (from @seeyourai/lint-rules) ─────────────────────────────

export type Severity = "error" | "warning" | "info";

export interface LintFix {
	description: string;
	apply: (content: string) => string;
}

export interface LintIssue {
	ruleId: string;
	severity: Severity;
	message: string;
	line?: number;
	column?: number;
	suggestion?: string;
	fix?: LintFix;
}

export interface LintResult {
	file: string;
	issues: LintIssue[];
	score: number;
}

export interface LintRule {
	id: string;
	name: string;
	description: string;
	severity: Severity;
	check(content: string, filePath: string): LintIssue[] | Promise<LintIssue[]>;
}

// ── MCP types (from @seeyourai/core) ────────────────────────────────────

export interface MCPContextStats {
	totalServers: number;
	totalTools: number;
	totalTokenImpact: number;
	servers: Array<{
		name: string;
		source: string;
		scope: "user" | "project";
		toolCount: number;
		tokenImpact: number;
		toolsUsed: number;
		tools: Array<{
			name: string;
			description?: string;
			estimatedTokens: number;
			inputSchema?: Record<string, unknown>;
		}>;
	}>;
}

// ── Shared types (from @seeyourai/shared-types) ─────────────────────────

export interface ToolCall {
	name: string;
	label?: string;
	arguments: Record<string, unknown>;
	result?: unknown;
	error?: string;
	durationMs?: number;
	resultSizeBytes?: number;
}
