/**
 * Model pricing utilities.
 * Inlined from @seeyourai/core for the OSS CLI.
 *
 * Contains a curated subset of model pricing for the models displayed in the CLI.
 * Full pricing snapshot: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
 */

export interface ModelPricing {
	input: number;
	output: number;
	cacheRead: number;
	cacheCreation: number;
}

/** ISO date of last snapshot update */
export const SNAPSHOT_DATE = "2026-02-24";

/**
 * Curated pricing snapshot for models displayed in the CLI.
 * Sourced from LiteLLM model_prices_and_context_window.json.
 */
const PRICING_SNAPSHOT: Record<string, ModelPricing> = {
	// Anthropic
	"claude-opus-4-6": {
		input: 0.000005,
		output: 0.000025,
		cacheRead: 5e-7,
		cacheCreation: 0.00000625,
	},
	"claude-sonnet-4-6": {
		input: 0.000003,
		output: 0.000015,
		cacheRead: 3e-7,
		cacheCreation: 0.00000375,
	},
	"claude-haiku-4-5": {
		input: 0.000001,
		output: 0.000005,
		cacheRead: 1e-7,
		cacheCreation: 0.00000125,
	},
	"claude-haiku-4-5-20251001": {
		input: 0.000001,
		output: 0.000005,
		cacheRead: 1e-7,
		cacheCreation: 0.00000125,
	},
	// OpenAI
	"gpt-5.2": { input: 0.00000175, output: 0.000014, cacheRead: 1.75e-7, cacheCreation: 0 },
	"gpt-5-mini": { input: 2.5e-7, output: 0.000002, cacheRead: 2.5e-8, cacheCreation: 0 },
	"gpt-5.2-codex": { input: 0.00000175, output: 0.000014, cacheRead: 1.75e-7, cacheCreation: 0 },
	// Google
	"gemini-3.1-pro-preview": {
		input: 0.000002,
		output: 0.000012,
		cacheRead: 2e-7,
		cacheCreation: 0,
	},
	"gemini-2.5-flash": { input: 3e-7, output: 0.0000025, cacheRead: 3e-8, cacheCreation: 0 },
};

// ── Display model list ──────────────────────────────────────────────────

/** Models shown in cost rows, cheapest → most expensive. */
export const DISPLAY_MODELS: Array<{ id: string; label: string }> = [
	// Anthropic
	{ id: "claude-opus-4-6", label: "Opus 4.6" },
	{ id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
	// OpenAI
	{ id: "gpt-5.2", label: "GPT-5.2" },
	{ id: "gpt-5-mini", label: "GPT-5 mini" },
	{ id: "gpt-5.2-codex", label: "Codex 5.3" },
	// Google
	{ id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
	{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

// ── Public API ──────────────────────────────────────────────────────────

/** Returns input pricing map from the bundled snapshot. */
export function getInputPricing(): Record<string, number> {
	const result: Record<string, number> = {};
	for (const [key, value] of Object.entries(PRICING_SNAPSHOT)) {
		result[key] = value.input;
	}
	return result;
}

/**
 * Cost per single request for a given token count and per-token input price.
 */
export function costPerRequest(tokens: number, inputPricePerToken: number): number {
	return tokens * inputPricePerToken;
}

/**
 * Format a USD per-request cost for display.
 * Uses 2 significant figures for small values.
 */
export function fmtCost(usd: number): string {
	if (usd === 0) return "$0";
	if (usd < 0.0001) return "<$0.0001";
	if (usd < 10) return `$${Number(usd.toPrecision(2))}`;
	return `$${usd.toFixed(0)}`;
}
