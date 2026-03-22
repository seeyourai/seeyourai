/**
 * LintEngine - Core linting engine for CLAUDE.md and AGENTS.md files.
 * Inlined from @seeyourai/lint-rules for the OSS CLI.
 *
 * Note: Ships with no default rules in OSS. Rules can be added via addRule().
 */

import type { LintIssue, LintResult, LintRule } from "./types.js";

const SEVERITY_WEIGHTS = {
	error: 10,
	warning: 5,
	info: 1,
};

const MAX_SCORE = 100;

function calculateDeduction(issues: LintIssue[], rules: LintRule[]): number {
	let deduction = 0;
	for (const issue of issues) {
		const rule = rules.find((r) => r.id === issue.ruleId);
		const severity = rule?.severity || "info";
		deduction += SEVERITY_WEIGHTS[severity];
	}
	return deduction;
}

function calculateScore(issues: LintIssue[], rules: LintRule[]): number {
	const deduction = calculateDeduction(issues, rules);
	return Math.max(0, MAX_SCORE - deduction);
}

export class LintEngine {
	private rules: LintRule[];

	constructor(rules?: LintRule[]) {
		this.rules = rules || [];
	}

	addRule(rule: LintRule): void {
		const existingIndex = this.rules.findIndex((r) => r.id === rule.id);
		if (existingIndex >= 0) {
			this.rules[existingIndex] = rule;
		} else {
			this.rules.push(rule);
		}
	}

	removeRule(ruleId: string): void {
		this.rules = this.rules.filter((r) => r.id !== ruleId);
	}

	getRules(): LintRule[] {
		return [...this.rules];
	}

	async lint(filePath: string, content: string): Promise<LintResult> {
		const allIssues: LintIssue[] = [];

		for (const rule of this.rules) {
			try {
				const issues = await Promise.resolve(rule.check(content, filePath));
				for (const issue of issues) {
					if (!issue.ruleId) {
						issue.ruleId = rule.id;
					}
					if (!issue.severity) {
						issue.severity = rule.severity;
					}
				}
				allIssues.push(...issues);
			} catch (error) {
				allIssues.push({
					ruleId: "engine",
					severity: "error",
					message: `Rule "${rule.id}" failed to execute: ${error instanceof Error ? error.message : String(error)}`,
				});
			}
		}

		const lines = content.split("\n");
		const filteredIssues = allIssues.filter((issue) => {
			if (issue.line === undefined) return true;
			const prevLineIdx = issue.line - 2;
			if (prevLineIdx >= 0 && prevLineIdx < lines.length) {
				const prevLine = lines[prevLineIdx].trim();
				const match = prevLine.match(/<!--\s*seeyourai-disable-next-line\s+([\w-]+)\s*-->/);
				if (match && match[1] === issue.ruleId) {
					return false;
				}
			}
			return true;
		});

		const score = calculateScore(filteredIssues, this.rules);

		return {
			file: filePath,
			issues: filteredIssues,
			score,
		};
	}

	async lintMany(files: Array<{ path: string; content: string }>): Promise<LintResult[]> {
		return Promise.all(files.map((f) => this.lint(f.path, f.content)));
	}

	async fix(filePath: string, content: string): Promise<string> {
		const result = await this.lint(filePath, content);
		let fixedContent = content;

		const fixableIssues = result.issues.filter((i) => i.fix !== undefined);
		if (fixableIssues.length === 0) {
			return content;
		}

		for (const issue of fixableIssues) {
			if (issue.fix) {
				fixedContent = issue.fix.apply(fixedContent);
			}
		}

		return fixedContent;
	}
}
