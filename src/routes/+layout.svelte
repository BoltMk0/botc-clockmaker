<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import "./style.css"
	let { children } = $props();

	function disableDoubleTapZoomGesture(){
		document.addEventListener('dblclick', function (event) {
			event.preventDefault();
		}, { passive: false });
	}
	onMount(() => {
		disableDoubleTapZoomGesture();
	});
</script>

<svelte:head>
	<link rel="icon" href="/icons/appicon_128x128.png" />
</svelte:head>

{@render children()}

<style>
	:global(body){
		margin: 0;
		padding: 0;
		display: flex;
		min-height: 100%;
		width: 100%;
		box-sizing: border-box;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		font-family: system-ui, sans-serif;
		background-color: #121212;
		background: linear-gradient(-120deg, #121212FF 10%, #12121288 20%, #14141477 24%, #131313CC 30%, #19191966 33%, #18181888 38%, #1d1d1d55 48%, #13131399 52%, #131313BB 60%, #13131388 70%, #131212cc 76%, #1f1d1ddd 95%, #1b1010FF 100%), linear-gradient(160deg, rgb(77, 71, 71) 0%, rgb(10, 10, 12) 80%);
		color: #f0f0f0;
		overscroll-behavior: none;
	}

	:global(img, svg, div){
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
</style>
