<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(body){
		margin: 0;
		padding: 0;
		display: flex;
		height: 100%;
		width: 100%;
		box-sizing: border-box;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		font-family: system-ui, sans-serif;
		background-color: #121212;
		color: #f0f0f0;
	}

	:global(img, svg, div){
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
</style>
