<script lang="ts">
	import { doubleTap } from "./doubleTap";

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

	// Double click/tap resets the slider to 0 (e.g. centred pan).
	function resetToZero() {
		value = 0;
		onchange(value);
		onchangefinished(value);
	}
</script>

<style>
.horizontal-slider {
	width: 100%;
	height: 32px;
    box-sizing: border-box;
    accent-color: var(--theme-slider-accent);
	/* No double-tap-to-zoom, which would otherwise eat the double tap that resets the slider */
	touch-action: manipulation;
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
	ondblclick={resetToZero}
	use:doubleTap={resetToZero}
	class="horizontal-slider"
/>
