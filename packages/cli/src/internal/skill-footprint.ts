/**
 * Skill Footprint Analyzer.
 * Inlined from @seeyourai/lint-rules for the OSS CLI.
 *
 * Scans .agents/skills/ directory and calculates the token footprint
 * of each SKILL.md file.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const CHARS_PER_TOKEN = 4;
const SKILLS_DIR = ".agents/skills";

export interface SkillFootprintEntry {
	name: string;
	skillMdPath: string;
	relativePath: string;
	chars: number;
	tokens: number;
	frontmatter: { name?: string; description?: string };
}

export interface SkillFootprint {
	skills: SkillFootprintEntry[];
	totalTokens: number;
	totalSkills: number;
	skillsDir: string;
}

function estimateTokens(chars: number): number {
	return Math.ceil(chars / CHARS_PER_TOKEN);
}

export function analyzeSkillFootprint(projectRoot: string): SkillFootprint {
	const skillsDir = path.join(projectRoot, SKILLS_DIR);

	if (!fs.existsSync(skillsDir)) {
		return {
			skills: [],
			totalTokens: 0,
			totalSkills: 0,
			skillsDir,
		};
	}

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(skillsDir, { withFileTypes: true });
	} catch {
		return {
			skills: [],
			totalTokens: 0,
			totalSkills: 0,
			skillsDir,
		};
	}

	const skills: SkillFootprintEntry[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
		if (!fs.existsSync(skillMdPath)) continue;

		let content: string;
		try {
			content = fs.readFileSync(skillMdPath, "utf-8");
		} catch {
			continue;
		}

		let frontmatter: { name?: string; description?: string } = {};
		try {
			const parsed = matter(content);
			frontmatter = {
				name: parsed.data.name as string | undefined,
				description: parsed.data.description as string | undefined,
			};
		} catch {
			// Frontmatter parse failure — still count the tokens
		}

		const chars = content.length;
		skills.push({
			name: entry.name,
			skillMdPath,
			relativePath: path.relative(projectRoot, skillMdPath),
			chars,
			tokens: estimateTokens(chars),
			frontmatter,
		});
	}

	skills.sort((a, b) => b.tokens - a.tokens);

	const totalTokens = skills.reduce((sum, s) => sum + s.tokens, 0);

	return {
		skills,
		totalTokens,
		totalSkills: skills.length,
		skillsDir,
	};
}
