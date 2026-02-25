<script lang="ts">
	export let value: number = 0;
	export let min: number = 0;
	export let max: number = 100;
	export let step: number = 1;
</script>

<style>
.horizontal-slider {
	width: 100%;
	height: 32px;
    box-sizing: border-box;
    accent-color: var(--theme-slider-accent);
}
</style>

<input
	type="range"
	min={min}
	max={max}
	step={step}
	bind:value
	class="horizontal-slider"
/>
