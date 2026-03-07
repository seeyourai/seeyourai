import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	server: {
		allowedHosts: true,
	},
	site: "https://docs.seeyour.ai",
	integrations: [
		starlight({
			title: "See Your AI",
			customCss: ["./src/styles/global.css"],
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/seeyourai/seeyourai" }],
			sidebar: [{ label: "Home", slug: "index" }],
		}),
	],

	vite: {
		plugins: [tailwindcss()],
		preview: {
			allowedHosts: true,
		},
		server: {
			allowedHosts: true,
		},
	},
});
