<script lang="ts">
	export let value: number = 0;
	export let min: number = 0;
	export let max: number = 100;
	export let step: number = 1;
	export let onchange: (value: number) => void = () => {};
	export let onchangefinished: (value: number) => void = () => {};

	function handleInput(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		value = v;
		onchange(value);
	}

	function handleChange(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		value = v;
		onchangefinished(value);
	}
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
	value={value}
	on:input={handleInput}
	on:change={handleChange}
	class="horizontal-slider"
/>
