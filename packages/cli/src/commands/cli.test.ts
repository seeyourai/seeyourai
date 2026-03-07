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

	it("registers the 'eval' command", () => {
		const program = createProgram();
		const evalCmd = program.commands.find((cmd) => cmd.name() === "eval");
		expect(evalCmd).toBeDefined();
		expect(evalCmd?.description()).toContain("eval");
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

describe("CLI 'eval' subcommands", () => {
	it("has 'eval init' subcommand", () => {
		const program = createProgram();
		const evalCmd = program.commands.find((cmd) => cmd.name() === "eval");
		const initCmd = evalCmd?.commands.find((cmd) => cmd.name() === "init");
		expect(initCmd).toBeDefined();
		expect(initCmd?.description()).toContain("Scaffold");
	});

	it("has 'eval list' subcommand", () => {
		const program = createProgram();
		const evalCmd = program.commands.find((cmd) => cmd.name() === "eval");
		const listCmd = evalCmd?.commands.find((cmd) => cmd.name() === "list");
		expect(listCmd).toBeDefined();
		expect(listCmd?.description()).toContain("List");
	});

	it("has 'eval run' subcommand", () => {
		const program = createProgram();
		const evalCmd = program.commands.find((cmd) => cmd.name() === "eval");
		const runCmd = evalCmd?.commands.find((cmd) => cmd.name() === "run");
		expect(runCmd).toBeDefined();
	});

	it("eval run has --json option", () => {
		const program = createProgram();
		const evalCmd = program.commands.find((cmd) => cmd.name() === "eval");
		const runCmd = evalCmd?.commands.find((cmd) => cmd.name() === "run");
		const options = runCmd?.options.map((o) => o.long);
		expect(options).toContain("--json");
	});

	it("eval run has --filter option", () => {
		const program = createProgram();
		const evalCmd = program.commands.find((cmd) => cmd.name() === "eval");
		const runCmd = evalCmd?.commands.find((cmd) => cmd.name() === "run");
		const options = runCmd?.options.map((o) => o.long);
		expect(options).toContain("--filter");
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
		expect(helpInfo).toContain("eval");
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
