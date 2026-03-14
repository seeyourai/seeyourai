/**
 * Context Footprint Analyzer.
 * Inlined from @seeyourai/lint-rules for the OSS CLI.
 *
 * Static analysis of CLAUDE.md and AGENTS.md to determine
 * what files always get loaded into an agent's context window.
 */

import fs from "node:fs";
import path from "node:path";
import { extractLinks, stripFragment } from "./link-extractor.js";

const CHARS_PER_TOKEN = 4;

export interface ContextFile {
	path: string;
	relativePath: string;
	exists: boolean;
	chars: number;
	tokens: number;
	loadedBy: string[];
	reason: ContextInclusionReason;
	linksTo: string[];
}

export type ContextInclusionReason = "root" | "claude-memory" | "md-link" | "import-directive";

export interface ContextFootprint {
	files: ContextFile[];
	totalTokens: number;
	missingFiles: ContextFile[];
	duplicateRefs: string[];
	maxDepth: number;
	hasCircularRefs: boolean;
	circularPaths: string[][];
}

export interface FootprintOptions {
	maxDepth?: number;
	includeClaudioMemory?: boolean;
	followTransitiveLinks?: boolean;
	followExtensions?: string[];
}

const DEFAULT_OPTIONS: Required<FootprintOptions> = {
	maxDepth: 5,
	includeClaudioMemory: true,
	followTransitiveLinks: true,
	followExtensions: [".md"],
};

function estimateTokens(chars: number): number {
	return Math.ceil(chars / CHARS_PER_TOKEN);
}

function readFileSafe(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

function scanClaudeMemoryDir(projectRoot: string): string[] {
	const claudeDir = path.join(projectRoot, ".claude");
	if (!fs.existsSync(claudeDir)) return [];

	try {
		const entries = fs.readdirSync(claudeDir, { withFileTypes: true });
		return entries
			.filter((e: fs.Dirent) => e.isFile() && e.name.endsWith(".md"))
			.map((e: fs.Dirent) => path.join(claudeDir, e.name));
	} catch (_e: unknown) {
		return [];
	}
}

export function analyzeContextFootprint(
	rootFilePath: string,
	projectRoot: string,
	options: FootprintOptions = {},
): ContextFootprint {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const followExts = new Set(opts.followExtensions);

	const fileMap = new Map<string, ContextFile>();
	const circularPaths: string[][] = [];
	let maxDepthReached = 0;

	function addFile(
		absPath: string,
		loadedBy: string,
		reason: ContextInclusionReason,
		depth: number,
		visitStack: string[],
	): void {
		const rel = path.relative(projectRoot, absPath);

		const existing = fileMap.get(absPath);
		if (existing) {
			if (!existing.loadedBy.includes(loadedBy)) {
				existing.loadedBy.push(loadedBy);
			}
			return;
		}

		if (depth > opts.maxDepth) return;
		maxDepthReached = Math.max(maxDepthReached, depth);

		const isDir = fs.existsSync(absPath) && fs.statSync(absPath).isDirectory();
		const content = isDir ? "" : readFileSafe(absPath);
		const exists = isDir || content !== null;
		const chars = content ? content.length : 0;

		const entry: ContextFile = {
			path: absPath,
			relativePath: rel,
			exists,
			chars,
			tokens: estimateTokens(chars),
			loadedBy: loadedBy ? [loadedBy] : [],
			reason,
			linksTo: [],
		};

		fileMap.set(absPath, entry);

		if (!exists || isDir || !opts.followTransitiveLinks) return;
		if (!followExts.has(path.extname(absPath).toLowerCase())) return;

		const newStack = [...visitStack, absPath];
		const links = extractLinks(content ?? "");
		const baseDir = path.dirname(absPath);

		for (const link of links) {
			if (!link.isLocal) continue;

			let href = stripFragment(link.href);
			try {
				href = decodeURIComponent(href);
			} catch {
				// leave as-is
			}
			if (!href) continue;

			const linkedAbs = path.resolve(baseDir, href);
			const linkedExt = path.extname(linkedAbs).toLowerCase();

			if (!entry.linksTo.includes(linkedAbs)) {
				entry.linksTo.push(linkedAbs);
			}

			if (newStack.includes(linkedAbs)) {
				const cycleStart = newStack.indexOf(linkedAbs);
				const cyclePath = [...newStack.slice(cycleStart), linkedAbs];
				const cycleKey = cyclePath.join(" -> ");
				if (!circularPaths.some((p) => p.join(" -> ") === cycleKey)) {
					circularPaths.push(cyclePath);
				}
				continue;
			}

			if (followExts.has(linkedExt)) {
				addFile(linkedAbs, absPath, "md-link", depth + 1, newStack);
			} else if (!fileMap.has(linkedAbs)) {
				const isLinkedDir = fs.existsSync(linkedAbs) && fs.statSync(linkedAbs).isDirectory();
				const linkedContent = isLinkedDir ? "" : readFileSafe(linkedAbs);
				const linkedExists = isLinkedDir || linkedContent !== null;
				const linkedChars = linkedContent ? linkedContent.length : 0;
				fileMap.set(linkedAbs, {
					path: linkedAbs,
					relativePath: path.relative(projectRoot, linkedAbs),
					exists: linkedExists,
					chars: linkedChars,
					tokens: estimateTokens(linkedChars),
					loadedBy: [absPath],
					reason: "md-link",
					linksTo: [],
				});
			}
		}
	}

	addFile(rootFilePath, "", "root", 0, []);

	if (opts.includeClaudioMemory) {
		for (const memFile of scanClaudeMemoryDir(projectRoot)) {
			addFile(memFile, projectRoot, "claude-memory", 1, [rootFilePath]);
		}
	}

	const files = Array.from(fileMap.values());
	const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);
	const missingFiles = files.filter((f) => !f.exists);

	const refCounts = new Map<string, number>();
	for (const f of files) {
		refCounts.set(f.path, (refCounts.get(f.path) ?? 0) + f.loadedBy.length);
	}
	const duplicateRefs = Array.from(refCounts.entries())
		.filter(([, count]) => count > 1)
		.map(([p]) => p);

	return {
		files,
		totalTokens,
		missingFiles,
		duplicateRefs,
		maxDepth: maxDepthReached,
		hasCircularRefs: circularPaths.length > 0,
		circularPaths,
	};
}
