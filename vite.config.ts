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
					{
						src: '/icons/appicon_128x128.png',
						sizes: '128x128',
						type: 'image/png'
					},
					{
						src: '/icons/appicon_192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icons/appicon_256x256.png',
						sizes: '256x256',
						type: 'image/png'
					},
					{
						src: '/icons/appicon_192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
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
