import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { z } from "zod";

const sessionProfileSchema = z.object({
	name: z.string(),
	requests: z.number().int().positive(),
});

const costEstimationSchema = z.object({
	/**
	 * Model ID used for session cost estimates (must be in pricing-snapshot).
	 * @example "claude-sonnet-4-6"
	 */
	model: z.string().default("claude-sonnet-4-6"),
	/**
	 * Session profiles used to show realistic cost estimates.
	 * Each profile represents a plausible number of Claude requests in one session.
	 * Sub-agents multiply request counts — a task spawning 3 sub-agents with 30
	 * turns each contributes ~90 additional requests, all loading your context docs.
	 */
	sessionProfiles: z.array(sessionProfileSchema).default([
		{ name: "simple task", requests: 10 },
		{ name: "typical session", requests: 30 },
		{ name: "complex + subagents", requests: 100 },
	]),
});

export type CostEstimationConfig = z.infer<typeof costEstimationSchema>;

export const configSchema = z.object({
	projectName: z.string().optional(),
	/**
	 * Preferred provider for headline cost display.
	 * When set, this provider's flagship model is always shown first in the quick scan.
	 * @example "anthropic"
	 */
	preferredProvider: z.enum(["anthropic", "openai", "google"]).optional(),
	autoCollect: z.boolean().default(false),
	tracingEnabled: z.boolean().default(true),
	collectorUrl: z.string().url().optional(),
	apiBaseUrl: z.string().url().optional(),
	apiKey: z.string().optional(),
	ignorePatterns: z.array(z.string()).default(["node_modules", ".git", "dist", "build"]),
	includePatterns: z.array(z.string()).default(["**/*.md", "**/*.ts", "**/*.js", "**/*.json"]),
	excludedDirectories: z
		.array(z.string())
		.default(["node_modules", ".git", "dist", "build", ".vscode"]),
	/** Cost estimation settings for sya context */
	costEstimation: costEstimationSchema.optional(),
	/** Context budget enforcement settings */
	contextBudget: z
		.object({
			/** Maximum percentage of model context window for capabilities. Default: 20 */
			maxContextTaxPercent: z.number().min(1).max(100).default(20),
			/** Absolute token limit override. Takes precedence over percentage. */
			maxContextTaxTokens: z.number().positive().optional(),
			/** Model whose context window is used for percentage calculation. */
			referenceModel: z.string().default("claude-sonnet-4-6"),
		})
		.optional(),
	/** MCP Analysis settings */
	mcp: z
		.object({
			/** Whether to enable MCP analysis at all */
			enabled: z.boolean().default(true),
			/** Whether to spawn servers to fetch exact tool counts */
			deepScan: z.boolean().default(true),
			/** Maximum time in ms to wait for an MCP server ping */
			pingTimeoutMs: z.number().default(5000),
			/** List of servers to ignore during analysis */
			ignoreServers: z.array(z.string()).default([]),
		})
		.default({
			enabled: true,
			deepScan: true,
			pingTimeoutMs: 5000,
			ignoreServers: [],
		}),
});

export type Config = z.infer<typeof configSchema>;

export const defaultConfig: Config = {
	autoCollect: false,
	tracingEnabled: true,
	ignorePatterns: ["node_modules", ".git", "dist", "build"],
	includePatterns: ["**/*.md", "**/*.ts", "**/*.js", "**/*.json"],
	excludedDirectories: ["node_modules", ".git", "dist", "build", ".vscode"],
	mcp: {
		enabled: true,
		deepScan: true,
		pingTimeoutMs: 5000,
		ignoreServers: [],
	},
};

const CONFIG_FILE_NAME = "syaconfig.json";

export function getConfigPath(cwd = process.cwd()): string {
	return path.join(cwd, CONFIG_FILE_NAME);
}

export function loadConfig(cwd = process.cwd()): Config {
	const configPath = getConfigPath(cwd);

	if (!fs.existsSync(configPath)) {
		return defaultConfig;
	}

	try {
		const content = fs.readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(content);
		const validated = configSchema.parse(parsed);
		return { ...defaultConfig, ...validated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error(chalk.red("Invalid syaconfig.json:"));
			for (const issue of error.issues) {
				console.error(chalk.red(`  - ${issue.path.join(".")}: ${issue.message}`));
			}
		} else {
			console.error(chalk.red(`Error loading config: ${error}`));
		}
		return defaultConfig;
	}
}

export function saveConfig(config: Config, cwd = process.cwd()): void {
	const configPath = getConfigPath(cwd);
	const validated = configSchema.parse(config);
	fs.writeFileSync(configPath, JSON.stringify(validated, null, "\t"));
}

export function updateConfig(updates: Partial<Config>, cwd = process.cwd()): Config {
	const current = loadConfig(cwd);
	const updated = { ...current, ...updates };
	saveConfig(updated, cwd);
	return updated;
}

export function configExists(cwd = process.cwd()): boolean {
	return fs.existsSync(getConfigPath(cwd));
}
