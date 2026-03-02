import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig, loadConfig, saveConfig, updateConfig } from "../src/config.js";

describe("CLI Config Update", () => {
	const testDir = path.join(process.cwd(), "test-tmp-config");

	beforeEach(() => {
		if (!fs.existsSync(testDir)) {
			fs.mkdirSync(testDir, { recursive: true });
		}
		saveConfig(defaultConfig, testDir);
	});

	afterEach(() => {
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	it("should update config values and persist them", () => {
		const newConfig = updateConfig(
			{ apiBaseUrl: "http://localhost:3001", autoCollect: true },
			testDir,
		);

		expect(newConfig.apiBaseUrl).toBe("http://localhost:3001");
		expect(newConfig.autoCollect).toBe(true);

		const loaded = loadConfig(testDir);
		expect(loaded.apiBaseUrl).toBe("http://localhost:3001");
		expect(loaded.autoCollect).toBe(true);
	});
});
