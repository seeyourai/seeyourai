/**
 * Link extractor for CLAUDE.md and AGENTS.md files.
 * Inlined from @seeyourai/lint-rules for the OSS CLI.
 */

export type LinkType = "inline" | "image" | "reference" | "html" | "import";

export interface ExtractedLink {
	text: string;
	href: string;
	line: number;
	column: number;
	type: LinkType;
	isLocal: boolean;
}

function isLocalHref(href: string): boolean {
	if (!href) return false;
	if (href.startsWith("#")) return false;
	if (href.startsWith("http://") || href.startsWith("https://")) return false;
	if (href.startsWith("mailto:") || href.startsWith("data:")) return false;
	if (href.startsWith("ftp://") || href.startsWith("//")) return false;
	return true;
}

export function stripFragment(href: string): string {
	const hashIndex = href.indexOf("#");
	return hashIndex >= 0 ? href.slice(0, hashIndex) : href;
}

export function extractLinks(content: string): ExtractedLink[] {
	const links: ExtractedLink[] = [];
	const lines = content.split("\n");

	const refDefinitions = new Map<string, string>();
	for (const line of lines) {
		const refDef = line.match(/^\s*\[([^\]]+)\]:\s*(\S+)/);
		if (refDef) {
			refDefinitions.set(refDef[1].toLowerCase(), refDef[2]);
		}
	}

	let inFencedCode = false;

	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		const line = lines[lineIdx];
		const lineNum = lineIdx + 1;

		if (line.match(/^`{3,}/) || line.match(/^~{3,}/)) {
			inFencedCode = !inFencedCode;
			continue;
		}
		if (inFencedCode) continue;

		const processedLine = removeInlineCode(line);

		// @import directives
		const importPatterns = [
			{ re: /@import\s+(\S+)/g, type: "import" as LinkType },
			{ re: /^@(\.{1,2}\/\S+\.md)/g, type: "import" as LinkType },
		];
		for (const { re, type } of importPatterns) {
			for (const m of processedLine.matchAll(re)) {
				const href = m[1];
				links.push({
					text: href,
					href,
					line: lineNum,
					column: (m.index ?? 0) + 1,
					type,
					isLocal: isLocalHref(href),
				});
			}
		}

		// Image links: ![alt](href)
		{
			const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
			for (const m of processedLine.matchAll(re)) {
				const href = m[2].split(/\s+/)[0];
				links.push({
					text: m[1],
					href,
					line: lineNum,
					column: (m.index ?? 0) + 1,
					type: "image",
					isLocal: isLocalHref(href),
				});
			}
		}

		// Inline links: [text](href)
		{
			const re = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
			for (const m of processedLine.matchAll(re)) {
				const href = m[2].split(/\s+/)[0];
				links.push({
					text: m[1],
					href,
					line: lineNum,
					column: (m.index ?? 0) + 1,
					type: "inline",
					isLocal: isLocalHref(href),
				});
			}
		}

		// Reference-style links: [text][ref]
		{
			const re = /(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g;
			for (const m of processedLine.matchAll(re)) {
				const refKey = (m[2] || m[1]).toLowerCase();
				const href = refDefinitions.get(refKey);
				if (href) {
					links.push({
						text: m[1],
						href,
						line: lineNum,
						column: (m.index ?? 0) + 1,
						type: "reference",
						isLocal: isLocalHref(href),
					});
				}
			}
		}

		// HTML-style links: href="..." and src="..."
		{
			const re = /(?:href|src)=["']([^"']+)["']/gi;
			for (const m of processedLine.matchAll(re)) {
				const href = m[1];
				links.push({
					text: href,
					href,
					line: lineNum,
					column: (m.index ?? 0) + 1,
					type: "html",
					isLocal: isLocalHref(href),
				});
			}
		}
	}

	const seen = new Set<string>();
	return links.filter((l) => {
		const key = `${l.line}:${l.column}:${l.href}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function removeInlineCode(line: string): string {
	return line.replace(/`{1,2}[^`]+`{1,2}/g, (match) => " ".repeat(match.length));
}
