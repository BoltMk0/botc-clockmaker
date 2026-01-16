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
				display: 'standalone',
				start_url: '/',
				scope: '/',
				display_override: ['standalone', 'minimal-ui'],
				background_color: '#121212',
				description: 'A clock for the BOTCT event',
				theme_color: '#2d4550',
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
