import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/cli.ts", "src/program.ts", "src/config.ts"],
	format: ["esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	minify: true,
	target: "es2022",
	platform: "node",
	// All internal @seeya/* workspace packages are bundled so the published CLI
	// is self-contained and doesn't require unpublished packages from npm.
	noExternal: [/^@seeyourai\//],
	// gray-matter is CJS and doesn't work when bundled into ESM output.
	// Keep it external and install via npm dependencies.
	external: ["gray-matter"],
	// Preserve the shebang that tsup strips during bundling.
	banner: {
		js: "#!/usr/bin/env node",
	},
});
