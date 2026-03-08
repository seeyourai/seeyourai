import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProgram } from "../program.js";

describe("CLI program structure", () => {
	it("creates a program with the correct name", () => {
		const program = createProgram();
		expect(program.name()).toBe("seeyourai");
	});

	it("has a version set", () => {
		const program = createProgram();
		expect(program.version()).toBeDefined();
	});

	it("registers the 'context' command", () => {
		const program = createProgram();
		const contextCmd = program.commands.find((cmd) => cmd.name() === "context");
		expect(contextCmd).toBeDefined();
		expect(contextCmd?.description()).toContain("context");
	});

	it("registers the 'mcp' command", () => {
		const program = createProgram();
		const mcpCmd = program.commands.find((cmd) => cmd.name() === "mcp");
		expect(mcpCmd).toBeDefined();
		expect(mcpCmd?.description()).toContain("MCP");
	});
});

describe("CLI 'context' command options", () => {
	it("has --json option", () => {
		const program = createProgram();
		const contextCmd = program.commands.find((cmd) => cmd.name() === "context");
		const options = contextCmd?.options.map((o) => o.long);
		expect(options).toContain("--json");
	});

	it("has --min-tokens option", () => {
		const program = createProgram();
		const contextCmd = program.commands.find((cmd) => cmd.name() === "context");
		const options = contextCmd?.options.map((o) => o.long);
		expect(options).toContain("--min-tokens");
	});
});

describe("CLI 'mcp' command options", () => {
	it("has --json option", () => {
		const program = createProgram();
		const mcpCmd = program.commands.find((cmd) => cmd.name() === "mcp");
		const options = mcpCmd?.options.map((o) => o.long);
		expect(options).toContain("--json");
	});

	it("has --live option", () => {
		const program = createProgram();
		const mcpCmd = program.commands.find((cmd) => cmd.name() === "mcp");
		const options = mcpCmd?.options.map((o) => o.long);
		expect(options).toContain("--live");
	});

	it("has --export option", () => {
		const program = createProgram();
		const mcpCmd = program.commands.find((cmd) => cmd.name() === "mcp");
		const options = mcpCmd?.options.map((o) => o.long);
		expect(options).toContain("--export");
	});
});

describe("CLI help text", () => {
	it("includes standard command listing in help text", () => {
		const program = createProgram();
		const helpInfo = program.helpInformation();
		expect(helpInfo).toContain("context");
		expect(helpInfo).toContain("mcp");
	});

	it("includes description in help text", () => {
		const program = createProgram();
		const helpInfo = program.helpInformation();
		expect(helpInfo).toContain("See Your AI");
	});

	it("includes version option in help text", () => {
		const program = createProgram();
		const helpInfo = program.helpInformation();
		expect(helpInfo).toContain("--version");
		expect(helpInfo).toContain("--help");
	});
});

// ── OSS Leak Detection ────────────────────────────────────────────────────
// Ensures no internal workspace packages leak into the OSS CLI.
// If a new command or dependency needs an internal package, this test will
// fail and force an explicit decision to inline or exclude it.

/**
 * Allowed internal package imports. Add entries here when intentionally
 * accepting a new dependency in the OSS build.
 *
 * To accept a new import:
 *   1. Inline the needed code into src/internal/
 *   2. Update the import to use the local module
 *   3. If the import MUST stay as a workspace reference, add it here with a comment
 */
const ALLOWED_WORKSPACE_IMPORTS: string[] = [
	// None — all @seeyourai/* imports should be inlined into src/internal/
];

describe("OSS leak detection", () => {
	it("does not import any @seeyourai/* workspace packages", () => {
		const srcDir = path.resolve(__dirname, "..");
		const violations = findWorkspaceImports(srcDir);

		if (violations.length > 0) {
			const report = violations.map((v) => `  ${v.file}:${v.line} → ${v.importPath}`).join("\n");
			throw new Error(
				`Found @seeyourai/* workspace imports that would break the OSS build:\n${report}\n\n` +
					"To fix: inline the needed code into src/internal/ and update the import path.\n" +
					"If intentional, add the import to ALLOWED_WORKSPACE_IMPORTS in this test.",
			);
		}
	});

	it("does not include the eval command (internal-only)", () => {
		const program = createProgram();
		const evalCmd = program.commands.find((cmd) => cmd.name() === "eval");
		expect(evalCmd).toBeUndefined();
	});

	it("does not reference @seeyourai/* in package.json dependencies", () => {
		const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

		const allDeps = {
			...pkg.dependencies,
			...pkg.devDependencies,
			...pkg.peerDependencies,
		};

		const wsPrefix = ["@", "seeyourai/"].join("");
		const workspaceDeps = Object.keys(allDeps).filter((dep) => dep.startsWith(wsPrefix));

		if (workspaceDeps.length > 0) {
			throw new Error(
				`Found @seeyourai/* workspace dependencies in package.json: ${workspaceDeps.join(", ")}\n` +
					"These packages don't exist in the OSS repo and will break pnpm install.",
			);
		}
	});
});

// ── Helpers ─────────────────────────────────────────────────────────────

interface Violation {
	file: string;
	line: number;
	importPath: string;
}

function findWorkspaceImports(dir: string, basePath = ""): Violation[] {
	const violations: Violation[] = [];

	let names: string[];
	try {
		names = readdirSync(dir, "utf-8");
	} catch {
		return violations;
	}

	for (const name of names) {
		const fullPath = path.join(dir, name);
		const relPath = path.join(basePath, name);

		let isDir: boolean;
		try {
			isDir = statSync(fullPath).isDirectory();
		} catch {
			continue;
		}

		if (isDir) {
			if (name === "node_modules" || name === "dist") continue;
			violations.push(...findWorkspaceImports(fullPath, relPath));
		} else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
			const content = readFileSync(fullPath, "utf-8");
			const lines = content.split("\n");
			// Build the pattern dynamically to avoid the scanner matching itself
			const prefix = ["@", "seeyourai/"].join("");
			const importRe = new RegExp(
				`(?:from|import\\(|require\\()\\s*["'](${prefix.replace("/", "\\/")}[^"']+)["']`,
			);

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const match = line.match(importRe);
				if (match && !ALLOWED_WORKSPACE_IMPORTS.includes(match[1])) {
					violations.push({
						file: relPath,
						line: i + 1,
						importPath: match[1],
					});
				}
			}
		}
	}

	return violations;
}
