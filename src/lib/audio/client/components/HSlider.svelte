<script lang="ts">
	let {
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		onchange = () => {},
		onchangefinished = () => {}
	}: {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		onchange?: (value: number) => void;
		onchangefinished?: (value: number) => void;
	} = $props();

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
	oninput={handleInput}
	onchange={handleChange}
	class="horizontal-slider"
/>
