/**
 * Local type definitions for Claude Code specific payloads.
 */

import type { ToolCall } from "../internal/types.js";

/**
 * Claude Code specific thought payload
 */
export interface ClaudeThoughtPayload {
	content?: string;
	promptId?: string;
	promptLength?: number;
	spanName?: string;
	confidence?: number;
}

/**
 * Claude Code specific tool call payload
 */
export interface ClaudeToolCallPayload extends ToolCall {
	promptId?: string;
	files?: string[];
	bashCommand?: string;
	exitCode?: number;
	stdOutput?: string;
	stdError?: string;
}

/**
 * Claude Code specific completion payload
 */
export interface ClaudeCompletionPayload {
	promptId?: string;
	/** Full response text — only available when captured via `seeyourai chat` */
	response?: string;
	inputTokens?: number;
	outputTokens?: number;
	cacheReadTokens?: number;
	cacheCreationTokens?: number;
	totalTokens?: number;
	costUsd?: number;
	model?: string;
	/** API round-trip duration in milliseconds */
	durationMs?: number;
}
