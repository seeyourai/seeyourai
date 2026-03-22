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
