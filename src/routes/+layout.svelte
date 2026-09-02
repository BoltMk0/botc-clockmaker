<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { pwaInfo } from 'virtual:pwa-info';
	import "./style.css"
	import "$lib/styles/common.css";
	let { children } = $props();
	let bodyContentEl: HTMLDivElement | null = null;

	function disableDoubleTapZoomGesture(){
		document.addEventListener('dblclick', function (event) {
			event.preventDefault();
		}, { passive: false });
	}
	onMount(() => {
		disableDoubleTapZoomGesture();

		if (browser) {
			// Registers the PWA service worker so the browser can detect this app
			// as installable. Dynamically imported so it's a no-op when the PWA
			// plugin is disabled (e.g. during dev without devOptions enabled).
			import('virtual:pwa-register/svelte').then(({ useRegisterSW }) => {
				useRegisterSW({ immediate: true });
			});
		}

		// Some mobile browsers are picky about nested scroll containers when the
		// document body itself isn't scrollable.
		const focusBodyContent = () => {
			if (!bodyContentEl) return;
			const active = document.activeElement;
			const isSafeToStealFocus =
				active === document.body ||
				active === document.documentElement ||
				(active instanceof HTMLElement && active.tabIndex === -1);
			if (!isSafeToStealFocus) return;
			bodyContentEl.focus({ preventScroll: true });
		};

		focusBodyContent();
		const onFirstTouch = () => {
			focusBodyContent();
			window.removeEventListener('touchstart', onFirstTouch);
		};
		window.addEventListener('touchstart', onFirstTouch, { passive: true });
	});
</script>

<svelte:head>
	<link rel="icon" href="/icons/appicon_128x128.png" />
	{#if pwaInfo}
		{@html pwaInfo.webManifest.linkTag}
	{/if}
</svelte:head>

<div class="body-content" bind:this={bodyContentEl} tabindex="-1">
	{@render children()}
</div>

<style>
	:global(html){
		height: 100%;
		width: 100%;
		color-scheme: only light;
	}
	
	:global(body){
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		font-family: system-ui, sans-serif;
		color: #f0f0f0;
		overflow: hidden;
	}

	:global(img, svg, div){
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}

	.body-content {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-sizing: border-box;
		align-items: center;
		justify-content: center;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		touch-action: pan-y;
		margin: 0;
		padding: 0;
		background-color: var(--theme-shadow);
	}

	.body-content:focus {
		outline: none;
	}
</style>
