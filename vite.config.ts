import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import {SvelteKitPWA} from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			includeAssets: [],
			manifest: {
				name: 'BOTCT Clock',
				short_name: 'BOTCT Clock',
				description: 'A clock for the BOTCT event',
				theme_color: '#ffffff',
				icons: [
				]
			}
		})
	],
	preview: {
		allowedHosts: ['*']
	},
	ssr: {
		noExternal: []
	}
});
